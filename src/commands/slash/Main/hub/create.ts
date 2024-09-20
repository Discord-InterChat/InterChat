import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { HubSettingsBits } from '#main/utils/BitFields.js';
import Constants, { emojis } from '#main/config/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { checkAndFetchImgurUrl, simpleEmbed } from '#main/utils/Utils.js';
import {
  ActionRowBuilder,
  CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import Hub from './index.js';

export default class Create extends Hub {
  readonly cooldown = 10 * 60 * 1000; // 10 mins

  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const isOnCooldown = await this.getRemainingCooldown(interaction);
    if (isOnCooldown) {
      await this.sendCooldownError(interaction, isOnCooldown, locale);
      return;
    }

    const modal = new ModalBuilder()
      .setTitle(t({ phrase: 'hub.create.modal.title', locale }))
      .setCustomId(new CustomID('hub_create_modal').toString())
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setLabel(t({ phrase: 'hub.create.modal.name.label', locale }))
            .setPlaceholder(t({ phrase: 'hub.create.modal.name.placeholder', locale }))
            .setMinLength(2)
            .setMaxLength(100)
            .setStyle(TextInputStyle.Short)
            .setCustomId('name'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setLabel(t({ phrase: 'hub.create.modal.description.label', locale }))
            .setPlaceholder(t({ phrase: 'hub.create.modal.description.placeholder', locale }))
            .setMaxLength(1024)
            .setStyle(TextInputStyle.Paragraph)
            .setCustomId('description'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setLabel(t({ phrase: 'hub.create.modal.icon.label', locale }))
            .setPlaceholder(t({ phrase: 'hub.create.modal.icon.placeholder', locale }))
            .setMaxLength(300)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setCustomId('icon'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setLabel(t({ phrase: 'hub.create.modal.banner.label', locale }))
            .setPlaceholder(t({ phrase: 'hub.create.modal.banner.placeholder', locale }))
            .setMaxLength(300)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setCustomId('banner'),
        ),
        // new ActionRowBuilder<TextInputBuilder>().addComponents(
        //   new TextInputBuilder()
        //     .setLabel('Language')
        //     .setPlaceholder('Pick a language for this hub.')
        //     .setStyle(TextInputStyle.Short)
        //     .setCustomId('language'),
        // ),
      );

    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('hub_create_modal')
  async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.fields.getTextInputValue('name');
    const description = interaction.fields.getTextInputValue('description');
    const icon = interaction.fields.getTextInputValue('icon');
    const banner = interaction.fields.getTextInputValue('banner');
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    // if hubName contains "discord", "clyde" "```" then return
    if (Constants.Regex.BannedWebhookWords.test(name)) {
      await interaction.followUp({
        content: t({ phrase: 'hub.create.invalidName', locale }, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    const hubs = await db.hubs.findMany({
      where: { OR: [{ ownerId: interaction.user.id }, { name }] },
    });

    if (hubs.find((hub) => hub.name === name)) {
      await interaction.followUp({
        content: t({ phrase: 'hub.create.nameTaken', locale }, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }
    else if (
      hubs.reduce((acc, hub) => (hub.ownerId === interaction.user.id ? acc + 1 : acc), 0) >= 3
    ) {
      await interaction.followUp({
        content: t({ phrase: 'hub.create.maxHubs', locale }, { emoji: emojis.no }),
        ephemeral: true,
      });
      return;
    }

    const iconUrl = icon ? await checkAndFetchImgurUrl(icon) : undefined;
    const bannerUrl = banner ? await checkAndFetchImgurUrl(banner) : undefined;

    // TODO: create a gif showing how to get imgur links
    if (iconUrl === false || bannerUrl === false) {
      await interaction.followUp({
        embeds: [simpleEmbed(t({ phrase: 'hub.invalidImgurUrl', locale }, { emoji: emojis.no }))],
        ephemeral: true,
      });
      return;
    }

    await db.hubs.create({
      data: {
        name,
        description,
        private: true,
        ownerId: interaction.user.id,
        iconUrl: iconUrl ?? Constants.Links.EasterAvatar,
        bannerUrl,
        settings:
          HubSettingsBits.SpamFilter | HubSettingsBits.Reactions | HubSettingsBits.BlockNSFW,
      },
    });

    // set cooldown after creating a hub (because a failed hub creation should not trigger the cooldown)
    interaction.client.commandCooldowns.setCooldown(
      `${interaction.user.id}-hub-create`,
      60 * 60 * 1000,
    ); // 1 hour

    const successEmbed = new EmbedBuilder()
      .setColor('Green')
      .setDescription(
        t(
          { phrase: 'hub.create.success', locale },
          { name, support_invite: Constants.Links.SupportInvite, docs_link: Constants.Links.Docs },
        ),
      )
      .setTimestamp();

    const command = Hub.subcommands.get('create');
    command?.setUserCooldown(interaction);

    await interaction.editReply({ embeds: [successEmbed] });
  }
}
