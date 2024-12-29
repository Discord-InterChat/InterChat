import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import HubLogManager, { LogConfigTypes as HubConfigTypes } from '#main/managers/HubLogManager.js';
import HubManager from '#main/managers/HubManager.js';
import { setComponentExpiry } from '#utils/ComponentUtils.js';
import Constants from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { hubEditSelects, hubEmbed } from '#utils/hub/edit.js';
import { sendToHub } from '#utils/hub/utils.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  Client,
  type MessageComponentInteraction,
  ModalBuilder,
  type ModalSubmitInteraction,
  RepliableInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import HubCommand from './index.js';

export default class HubEdit extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const { hub, locale } = await this.getInitialData(interaction);
    if (!hub) return;

    const embed = await this.getRefreshedEmbed(hub, interaction.client);
    await interaction.reply({
      embeds: [embed],
      components: [hubEditSelects(hub.id, interaction.user.id, locale)],
    });

    await this.setComponentExpiry(interaction);
  }

  @RegisterInteractionHandler('hub_edit', 'actions')
  async handleActionsSelect(interaction: MessageComponentInteraction) {
    if (!interaction.isStringSelectMenu()) return;

    const { hub, locale } = await this.componentChecks(interaction);
    if (!hub) return;

    const action = interaction.values[0];
    await this.handleAction(interaction, hub, action, locale);
  }

  @RegisterInteractionHandler('hub_edit', 'logsChSel')
  async handleChannelSelects(interaction: MessageComponentInteraction) {
    if (!interaction.isChannelSelectMenu()) return;

    const { hub, customId, locale } = await this.componentChecks(interaction);
    if (!hub) return;

    const type = customId.args[2] as HubConfigTypes;
    const channel = interaction.channels.first();
    if (!channel) return;

    await this.updateLogChannel(interaction, await hub.fetchLogConfig(), type, channel.id, locale);
  }

  @RegisterInteractionHandler('hub_edit_modal')
  async handleModals(interaction: ModalSubmitInteraction) {
    const { hub, customId, locale } = await this.modalChecks(interaction);
    if (!hub) return;

    switch (customId.suffix) {
      case 'description':
        await this.updateDescription(interaction, hub.id, locale);
        break;
      case 'icon':
        await this.updateIcon(interaction, hub.id, locale);
        break;
      case 'banner':
        await this.updateBanner(interaction, hub.id, locale);
        break;
      default:
        break;
    }

    await this.updateOriginalMessage(interaction, hub.id);
  }

  // Helper methods...

  private async getInitialData(interaction: ChatInputCommandInteraction) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const chosenHub = interaction.options.getString('hub', true);
    const hub = (await this.hubService.findHubsByName(chosenHub)).at(0);

    if (!hub) {
      await this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }));
      return { hub: null, locale };
    }
    else if (!(await hub.isManager(interaction.user.id))) {
      await this.replyEmbed(interaction, t('hub.notManager', locale, { emoji: this.getEmoji('x_icon') }));
      return { hub: null, locale };
    }

    return { hub, locale };
  }

  private async setComponentExpiry(interaction: ChatInputCommandInteraction) {
    const reply = await interaction.fetchReply();
    setComponentExpiry(interaction.client.getScheduler(), reply, 60 * 5000);
  }

  private async handleAction(
    interaction: MessageComponentInteraction,
    hub: HubManager,
    action: string,
    locale: supportedLocaleCodes,
  ) {
    switch (action) {
      case 'icon':
      case 'description':
      case 'banner':
        await this.showModal(interaction, hub.id, action, locale);
        break;
      case 'toggle_lock':
        await this.toggleLock(interaction, hub);
        break;
      default:
        break;
    }
  }

  private async showModal(
    interaction: MessageComponentInteraction,
    hubId: string,
    type: 'icon' | 'banner' | 'description',
    locale: supportedLocaleCodes,
  ) {
    const modal = new ModalBuilder()
      .setCustomId(new CustomID(`hub_edit_modal:${type}`, [hubId]).toString())
      .setTitle(t(`hub.manage.${type}.modal.title`, locale));

    const inputField = new TextInputBuilder()
      .setLabel(t(`hub.manage.${type}.modal.label`, locale))
      .setStyle(type === 'description' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setCustomId(type);

    if (type === 'description') {
      inputField.setMaxLength(1024);
    }
    else {
      inputField.setPlaceholder(t('hub.manage.enterImgurUrl', locale));
    }

    if (type === 'banner') {
      inputField.setRequired(false);
    }

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(inputField));

    await interaction.showModal(modal);
  }

  private async toggleLock(interaction: MessageComponentInteraction, hub: HubManager) {
    await interaction.deferReply({ ephemeral: true });

    await hub.setLocked(!hub.data.locked);
    const lockedStatus = hub.data.locked ? 'locked' : 'unlocked';

    await this.replyEmbed(
      interaction,
      `${lockedStatus === 'locked' ? '🔒' : '🔓'} Hub chats are now **${lockedStatus}**.`,
    );

    const embed = await this.getRefreshedEmbed(hub, interaction.client);
    await interaction.message.edit({ embeds: [embed] }).catch(() => null);

    await sendToHub(hub.id, {
      username: hub.data.name ?? 'InterChat Hub Announcement',
      avatarURL: hub.data.iconUrl,
      embeds: [
        new InfoEmbed()
          .setTitle(`🛡️ Hub chats are now ${lockedStatus}.`)
          .setDescription(
            `${lockedStatus === 'locked' ? 'Only moderators can send messages.' : 'Everyone can send messages.'}`,
          ),
      ],
    });
  }

  private async updateLogChannel(
    interaction: MessageComponentInteraction,
    logManager: HubLogManager,
    type: HubConfigTypes,
    channelId: string,
    locale: supportedLocaleCodes,
  ) {
    await logManager.setLogChannel(type, channelId);

    const embed = interaction.message.embeds[0].toJSON();
    const channelStr = this.channelMention(channelId);
    if (embed.fields?.at(0)) embed.fields[0].value = channelStr;
    await interaction.update({ embeds: [embed] });

    await interaction.followUp({
      embeds: [
        new InfoEmbed().setDescription(
          t('hub.manage.logs.channelSuccess', locale, {
            emoji: this.getEmoji('tick_icon'),
            type,
            channel: channelStr,
          }),
        ),
      ],
      ephemeral: true,
    });
  }

  private async updateDescription(
    interaction: ModalSubmitInteraction,
    hubId: string,
    locale: supportedLocaleCodes,
  ) {
    const description = interaction.fields.getTextInputValue('description');
    const hub = await this.hubService.fetchHub(hubId);

    if (!hub) {
      await interaction.reply({
        content: t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }),
        ephemeral: true,
      });
      return;
    }

    await hub.setDescription(description);

    await interaction.reply({
      content: t('hub.manage.description.changed', locale),
      ephemeral: true,
    });
  }

  private async updateIcon(
    interaction: ModalSubmitInteraction,
    hubId: string,
    locale: supportedLocaleCodes,
  ) {
    const iconUrl = interaction.fields.getTextInputValue('icon');

    const regex = Constants.Regex.ImageURL;
    if (!regex.test(iconUrl)) {
      await interaction.editReply(t('hub.invalidImgurUrl', locale, { emoji: this.getEmoji('x_icon') }));
      return;
    }

    const hub = await this.getHubOrError(interaction, hubId, locale);
    if (!hub) return;

    await hub.setIconUrl(iconUrl);

    await interaction.reply({
      content: t('hub.manage.icon.changed', locale),
      ephemeral: true,
    });
  }

  private async updateBanner(
    interaction: ModalSubmitInteraction,
    hubId: string,
    locale: supportedLocaleCodes,
  ) {
    await interaction.deferReply({ ephemeral: true });

    const hub = await this.getHubOrError(interaction, hubId, locale);
    if (!hub) return;

    const bannerUrl = interaction.fields.getTextInputValue('banner');
    if (!bannerUrl) {
      await hub.setBannerUrl(null);
      await interaction.editReply(t('hub.manage.banner.removed', locale));
      return;
    }

    // check if imgur url is a valid jpg, png, jpeg or gif and NOT a gallery or album link
    const regex = Constants.Regex.ImageURL;
    if (!regex.test(bannerUrl)) {
      await interaction.editReply(t('hub.invalidImgurUrl', locale, { emoji: this.getEmoji('x_icon') }));
      return;
    }

    await hub.setBannerUrl(bannerUrl);

    await interaction.editReply(this.getEmoji('tick_icon') + t('hub.manage.banner.changed', locale));
  }

  private async updateOriginalMessage(interaction: ModalSubmitInteraction, hubId: string) {
    const updatedHub = await this.hubService.fetchHub(hubId);

    if (updatedHub) {
      const embed = await this.getRefreshedEmbed(updatedHub, interaction.client);
      await interaction.message?.edit({ embeds: [embed] }).catch(() => null);
    }
  }

  private async componentChecks(interaction: MessageComponentInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (customId.args[0] !== interaction.user.id) {
      const embed = new InfoEmbed().setDescription(
        t('errors.notYourAction', locale, { emoji: this.getEmoji('x_icon') }),
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return {};
    }

    const hub = await this.hubService.fetchHub(customId.args[1]);
    if (!hub) {
      const embed = new InfoEmbed().setDescription(t('hub.notFound', locale, { emoji: this.getEmoji('x_icon') }));
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return {};
    }

    return { hub, customId, locale };
  }

  private async modalChecks(interaction: ModalSubmitInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId] = customId.args;
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const hub = await this.hubService.fetchHub(hubId);

    if (!(await hub?.isManager(interaction.user.id))) {
      await interaction.reply({
        content: t('hub.notManager', locale, { emoji: this.getEmoji('x_icon') }),
        ephemeral: true,
      });
      return {};
    }

    return { hub, customId, locale };
  }

  private channelMention(channelId: string | null | undefined) {
    if (!channelId) return this.getEmoji('x_icon');
    return `<#${channelId}>`;
  }

  private async getHubOrError(
    interaction: RepliableInteraction,
    hubId: string,
    locale: supportedLocaleCodes,
  ) {
    const hub = await this.hubService.fetchHub(hubId);

    if (!hub) {
      await interaction.reply({
        content: t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }),
        ephemeral: true,
      });
      return null;
    }

    return hub;
  }

  private async getRefreshedEmbed(hub: HubManager, client: Client) {
    const connections = await hub.fetchConnections();
    const mods = await hub.moderators.fetchAll();
    return await hubEmbed(hub.data, connections.length, mods.size, client);
  }
}
