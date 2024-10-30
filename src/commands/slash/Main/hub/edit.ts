import Constants, { emojis } from '#main/config/Constants.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import HubLogManager, { LogConfigTypes as HubConfigTypes } from '#main/managers/HubLogManager.js';
import { setComponentExpiry } from '#utils/ComponentUtils.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { hubEditSelects, hubEmbed } from '#utils/hub/edit.js';
import { sendToHub } from '#utils/hub/utils.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import type { Hub } from '@prisma/client';
import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import HubCommand from './index.js';

export default class HubEdit extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const { hubInDb, locale } = await this.getInitialData(interaction);
    if (!hubInDb) return;

    await interaction.reply({
      embeds: [await hubEmbed(hubInDb)],
      components: [hubEditSelects(hubInDb.id, interaction.user.id, locale)],
    });

    await this.setComponentExpiry(interaction);
  }

  @RegisterInteractionHandler('hub_edit', 'actions')
  async handleActionsSelect(interaction: MessageComponentInteraction) {
    if (!interaction.isStringSelectMenu()) return;

    const { hubInDb, locale } = await this.componentChecks(interaction);
    if (!hubInDb) return;

    const action = interaction.values[0];
    await this.handleAction(interaction, hubInDb, action, locale);
  }

  @RegisterInteractionHandler('hub_edit', 'logsChSel')
  async handleChannelSelects(interaction: MessageComponentInteraction) {
    if (!interaction.isChannelSelectMenu()) return;

    const { hubInDb, customId, locale } = await this.componentChecks(interaction);
    if (!hubInDb) return;

    const type = customId.args[2] as HubConfigTypes;
    const channel = interaction.channels.first();
    if (!channel) return;

    await this.updateLogChannel(interaction, hubInDb, type, channel.id, locale);
  }

  @RegisterInteractionHandler('hub_edit_modal')
  async handleModals(interaction: ModalSubmitInteraction) {
    const { hubInDb, customId, locale } = await this.modalChecks(interaction);
    if (!hubInDb) return;

    switch (customId.suffix) {
      case 'description':
        await this.updateDescription(interaction, hubInDb.id, locale);
        break;
      case 'icon':
        await this.updateIcon(interaction, hubInDb.id, locale);
        break;
      case 'banner':
        await this.updateBanner(interaction, hubInDb.id, locale);
        break;
    }

    await this.updateOriginalMessage(interaction, hubInDb.id);
  }

  // Helper methods...

  private async getInitialData(interaction: ChatInputCommandInteraction) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const chosenHub = interaction.options.getString('hub', true);
    const hubInDb = await this.fetchHubFromDb(interaction.user.id, chosenHub);

    if (!hubInDb) {
      await this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: emojis.no }));
      return { hubInDb: null, locale };
    }

    return { hubInDb, locale };
  }

  private async fetchHubFromDb(userId: string, hubName: string) {
    return await db.hub.findFirst({
      where: {
        name: hubName,
        OR: [{ ownerId: userId }, { moderators: { some: { userId, position: 'manager' } } }],
      },
      include: { connections: true },
    });
  }

  private async setComponentExpiry(interaction: ChatInputCommandInteraction) {
    const reply = await interaction.fetchReply();
    setComponentExpiry(interaction.client.getScheduler(), reply, 60 * 5000);
  }

  private async handleAction(
    interaction: MessageComponentInteraction,
    hubInDb: Hub,
    action: string,
    locale: supportedLocaleCodes,
  ) {
    switch (action) {
      case 'icon':
      case 'description':
      case 'banner':
        await this.showModal(interaction, hubInDb.id, action, locale);
        break;
      case 'toggle_lock':
        await this.toggleLock(interaction, hubInDb);
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

  private async toggleLock(interaction: MessageComponentInteraction, hubInDb: Hub) {
    await interaction.deferReply({ ephemeral: true });

    const updatedHub = await db.hub.update({
      where: { id: hubInDb?.id },
      data: { locked: !hubInDb?.locked },
      include: { connections: true },
    });

    const lockedStatus = updatedHub.locked ? 'locked' : 'unlocked';

    await this.replyEmbed(
      interaction,
      `${lockedStatus === 'locked' ? '🔒' : '🔓'} Hub chats are now **${lockedStatus}**.`,
    );

    await interaction.message.edit({ embeds: [await hubEmbed(updatedHub)] }).catch(() => null);

    await sendToHub(updatedHub.id, {
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
    hubInDb: Hub,
    type: HubConfigTypes,
    channelId: string,
    locale: supportedLocaleCodes,
  ) {
    const logManager = await HubLogManager.create(hubInDb.id);
    await logManager.setLogChannel(type, channelId);

    const embed = interaction.message.embeds[0].toJSON();
    const channelStr = this.channelMention(channelId);
    if (embed.fields?.at(0)) embed.fields[0].value = channelStr;
    await interaction.update({ embeds: [embed] });

    await interaction.followUp({
      embeds: [
        new InfoEmbed().setDescription(
          t('hub.manage.logs.channelSuccess', locale, {
            emoji: emojis.yes,
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
    await db.hub.update({
      where: { id: hubId },
      data: { description },
    });

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
      await interaction.editReply(t('hub.invalidImgurUrl', locale, { emoji: emojis.no }));
      return;
    }

    await db.hub.update({ where: { id: hubId }, data: { iconUrl } });

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

    const bannerUrl = interaction.fields.getTextInputValue('banner');

    if (!bannerUrl) {
      await db.hub.update({
        where: { id: hubId },
        data: { bannerUrl: { unset: true } },
      });

      await interaction.editReply(t('hub.manage.banner.removed', locale));
      return;
    }

    // check if imgur url is a valid jpg, png, jpeg or gif and NOT a gallery or album link
    const regex = Constants.Regex.ImageURL;
    if (!regex.test(bannerUrl)) {
      await interaction.editReply(t('hub.invalidImgurUrl', locale, { emoji: emojis.no }));
      return;
    }

    await db.hub.update({
      where: { id: hubId },
      data: { bannerUrl },
    });

    await interaction.editReply(emojis.yes + t('hub.manage.banner.changed', locale));
  }

  private async updateOriginalMessage(interaction: ModalSubmitInteraction, hubId: string) {
    const updatedHub = await db.hub.findFirst({
      where: { id: hubId },
      include: { connections: true },
    });

    if (updatedHub) {
      await interaction.message?.edit({ embeds: [await hubEmbed(updatedHub)] }).catch(() => null);
    }
  }

  private async componentChecks(interaction: MessageComponentInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (customId.args[0] !== interaction.user.id) {
      const embed = new InfoEmbed().setDescription(
        t('errors.notYourAction', locale, { emoji: emojis.no }),
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return {};
    }

    const hubInDb = await db.hub.findFirst({
      where: { id: customId.args[1] },
      include: { connections: true },
    });

    if (!hubInDb) {
      const embed = new InfoEmbed().setDescription(t('hub.notFound', locale, { emoji: emojis.no }));

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return {};
    }

    return { hubInDb, customId, locale };
  }

  private async modalChecks(interaction: ModalSubmitInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId] = customId.args;
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const hubInDb = await db.hub.findFirst({
      where: {
        id: hubId,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
      include: { connections: true },
    });

    if (!hubInDb) {
      await interaction.reply({
        content: t('hub.notFound_mod', locale, { emoji: emojis.no }),
        ephemeral: true,
      });
      return {};
    }

    return { hubInDb, customId, locale };
  }

  private channelMention(channelId: string | null | undefined) {
    if (!channelId) return emojis.no;
    return `<#${channelId}>`;
  }
}
