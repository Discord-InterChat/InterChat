import {
  ChatInputCommandInteraction,
  CacheType,
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
} from 'discord.js';
import Hub from './index.js';
import db from '../../../../utils/Db.js';
import { RegisterInteractionHandler } from '../../../../decorators/Interaction.js';
import { HubSettingsBits } from '../../../../utils/BitFields.js';
import { checkAndFetchImgurUrl, simpleEmbed } from '../../../../utils/Utils.js';
import { LINKS, emojis } from '../../../../utils/Constants.js';
import { t } from '../../../../utils/Locale.js';
import { CustomID } from '../../../../utils/CustomID.js';

export default class Create extends Hub {
  readonly cooldown = 60 * 60 * 1000; // 1 hour

  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const { locale } = interaction.user;

    const isOnCooldown = this.getRemainingCooldown(interaction);
    if (isOnCooldown) return this.sendCooldownError(interaction, isOnCooldown);

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
  async handleModals(interaction: ModalSubmitInteraction<CacheType>) {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.fields.getTextInputValue('name');
    const description = interaction.fields.getTextInputValue('description');
    const icon = interaction.fields.getTextInputValue('icon');
    const banner = interaction.fields.getTextInputValue('banner');

    // if hubName contains "discord", "clyde" "```" then return
    if (name.match(/discord|clyde|```/gi)) {
      return await interaction.followUp({
        content: t(
          { phrase: 'hub.create.invalidName', locale: interaction.user.locale },
          { emoji: emojis.no },
        ),
        ephemeral: true,
      });
    }

    const hubs = await db.hubs.findMany({
      where: { OR: [{ ownerId: interaction.user.id }, { name }] },
    });

    if (hubs.find((hub) => hub.name === name)) {
      return await interaction.followUp({
        content: t(
          { phrase: 'hub.create.nameTaken', locale: interaction.user.locale },
          { emoji: emojis.no },
        ),
        ephemeral: true,
      });
    }
    else if (
      hubs.reduce((acc, hub) => (hub.ownerId === interaction.user.id ? acc + 1 : acc), 0) >= 3
    ) {
      return await interaction.followUp({
        content: t(
          { phrase: 'hub.create.maxHubs', locale: interaction.user.locale },
          { emoji: emojis.no },
        ),
        ephemeral: true,
      });
    }

    const iconUrl = icon ? await checkAndFetchImgurUrl(icon) : undefined;
    const bannerUrl = banner ? await checkAndFetchImgurUrl(banner) : undefined;

    // TODO create a gif showing how to get imgur links
    if (iconUrl === false || bannerUrl === false) {
      return await interaction.followUp({
        embeds: [
          simpleEmbed(
            t(
              { phrase: 'hub.invalidImgurUrl', locale: interaction.user.locale },
              { emoji: emojis.no },
            ),
          ),
        ],
        ephemeral: true,
      });
    }

    await db.hubs.create({
      data: {
        name,
        description,
        private: true,
        ownerId: interaction.user.id,
        iconUrl: iconUrl ?? LINKS.EASTER_AVATAR,
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
          { phrase: 'hub.create.success', locale: interaction.user.locale },
          { name, support_invite: LINKS.SUPPORT_INVITE, docs_link: LINKS.DOCS },
        ),
      )
      .setTimestamp();

    const command = Hub.subcommands.get('create');
    command?.setCooldownFor(interaction);

    await interaction.editReply({ embeds: [successEmbed] });
  }
}
