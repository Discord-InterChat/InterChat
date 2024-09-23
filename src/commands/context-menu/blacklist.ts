import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import ServerBlacklisManager from '#main/modules/ServerBlacklistManager.js';
import UserDbManager from '#main/modules/UserDbManager.js';
import { deleteConnections } from '#main/utils/ConnectedListUtils.js';
import Constants, { emojis } from '#main/config/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { logBlacklist } from '#main/utils/HubLogger/ModLogs.js';
import { t, type supportedLocaleCodes } from '#main/utils/Locale.js';
import Logger from '#main/utils/Logger.js';
import { broadcastedMessages, hubs, originalMessages } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Interaction,
  ModalBuilder,
  Snowflake,
  TextInputBuilder,
  TextInputStyle,
  time,
  type MessageComponentInteraction,
  type MessageContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import parse from 'parse-duration';
import { isStaffOrHubMod } from '#main/utils/hub/utils.js';

type DbMessageT = originalMessages & { hub: hubs | null; broadcastMsgs: broadcastedMessages[] };

export default class Blacklist extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Blacklist',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const { userManager } = interaction.client;
    const userData = await userManager.getUser(interaction.user.id);
    const locale = await userManager.getUserLocale(userData);

    const originalMsg = await this.fetchMessageFromDb(interaction.targetId, {
      hub: true,
      broadcastMsgs: true,
    });

    if (!originalMsg?.hub || !isStaffOrHubMod(interaction.user.id, originalMsg.hub)) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'errors.messageNotSentOrExpired', locale }, { emoji: emojis.info }),
        { ephemeral: true, edit: true },
      );

      return;
    }

    if (originalMsg.authorId === interaction.user.id) {
      await interaction.editReply(
        '<a:nuhuh:1256859727158050838> Nuh uh! You can\'t blacklist yourself.',
      );
      return;
    }

    const user = await interaction.client.users.fetch(originalMsg.authorId);
    const server = await interaction.client.fetchGuild(originalMsg.serverId);

    const isUserBlacklisted = await this.isBlacklisted(
      originalMsg.authorId,
      originalMsg.hub.id,
      interaction.client.userManager,
    );
    const isServerBlacklisted = await this.isBlacklisted(
      originalMsg.serverId,
      originalMsg.hub.id,
      interaction.client.serverBlacklists,
    );

    const userEmbedDesc = t(
      {
        phrase: isUserBlacklisted
          ? 'blacklist.embed.userAlreadyBlacklisted'
          : 'blacklist.embed.userValue',
        locale,
      },
      { user: user.username },
    );
    const serverEmbedDesc = t(
      {
        phrase: isServerBlacklisted
          ? 'blacklist.embed.serverAlreadyBlacklisted'
          : 'blacklist.embed.serverValue',
        locale,
      },
      { server: `${server?.name}` },
    );

    const embed = new EmbedBuilder()
      .setColor(Constants.Colors.invisible)
      .setFooter({ text: t({ phrase: 'blacklist.embed.footer', locale }) })
      .setDescription(stripIndents`
          ### ${emojis.timeout_icon} Create A Blacklist
          **${t({ phrase: 'blacklist.embed.user', locale }, { emoji: emojis.user_icon })}:** ${userEmbedDesc}
          **${t({ phrase: 'blacklist.embed.server', locale }, { emoji: emojis.globe_icon })}:** ${serverEmbedDesc}
      `);

    const buttons = this.buildButtons(
      interaction,
      originalMsg.messageId,
      isUserBlacklisted,
      isServerBlacklisted,
    );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  }

  @RegisterInteractionHandler('blacklist')
  async handleButtons(interaction: MessageComponentInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    if (customId.prefix !== 'blacklist') return;
    const [userId, originalMsgId] = customId.args;

    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

    if (interaction.user.id !== userId) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'errors.notYourAction', locale }, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    const modal = new ModalBuilder()
      .setTitle('Blacklist')
      .setCustomId(
        new CustomID()
          .setIdentifier('blacklist_modal', customId.suffix)
          .addArgs(originalMsgId)
          .toString(),
      )
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel(t({ phrase: 'blacklist.modal.reason.label', locale }))
            .setPlaceholder(t({ phrase: 'blacklist.modal.reason.placeholder', locale }))
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel(t({ phrase: 'blacklist.modal.duration.label', locale }))
            .setPlaceholder(t({ phrase: 'blacklist.modal.duration.placeholder', locale }))
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setRequired(false),
        ),
      );

    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('blacklist_modal')
  override async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferUpdate();

    const customId = CustomID.parseCustomId(interaction.customId);
    const [messageId] = customId.args;
    const originalMsg = await this.fetchMessageFromDb(messageId);

    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

    if (!originalMsg?.hubId) {
      await interaction.editReply(
        t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      );
      return;
    }

    const blacklistType = customId.suffix as 'user' | 'server';
    const idToBlacklist = blacklistType === 'user' ? originalMsg.authorId : originalMsg.serverId;
    const manager =
      blacklistType === 'user'
        ? interaction.client.userManager
        : interaction.client.serverBlacklists;

    if (await this.isBlacklisted(idToBlacklist, originalMsg.hubId, manager)) {
      await this.replyEmbed(
        interaction,
        t(
          { phrase: `blacklist.${blacklistType}.alreadyBlacklisted`, locale },
          { emoji: emojis.no },
        ),
        { ephemeral: true },
      );
      return;
    }

    if (customId.suffix === 'user') {
      await this.handleUserBlacklist(interaction, originalMsg, locale);
    }
    else {
      await this.handleServerBlacklist(interaction, originalMsg, locale);
    }
  }

  private async handleUserBlacklist(
    interaction: ModalSubmitInteraction,
    originalMsg: DbMessageT,
    locale: supportedLocaleCodes,
  ) {
    const user = await interaction.client.users.fetch(originalMsg.authorId).catch(() => null);

    if (!user) {
      await this.replyEmbed(
        interaction,
        `${emojis.neutral} Unable to fetch user. They may have deleted their account?`,
        { ephemeral: true },
      );
      return;
    }

    if (!originalMsg.hubId) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    const { reason, expires } = this.getModalData(interaction);
    const { userManager } = interaction.client;
    const successEmbed = this.buildSuccessEmbed(reason, expires, locale).setDescription(
      t(
        { phrase: 'blacklist.user.success', locale },
        { username: user?.username ?? 'Unknown User', emoji: emojis.tick },
      ),
    );

    await userManager.addBlacklist({ id: user.id, name: user.username }, originalMsg.hubId, {
      reason,
      moderatorId: interaction.user.id,
      expires,
    });

    if (user) {
      userManager
        .sendNotification({ target: user, hubId: originalMsg.hubId, expires, reason })
        .catch(() => null);

      await logBlacklist(originalMsg.hubId, interaction.client, {
        target: user,
        mod: interaction.user,
        reason,
        expires,
      });
    }

    Logger.info(
      `User ${user?.username} blacklisted by ${interaction.user.username} in ${originalMsg.hub?.name}`,
    );

    await interaction.editReply({ embeds: [successEmbed], components: [] });
  }

  private async handleServerBlacklist(
    interaction: ModalSubmitInteraction,
    originalMsg: originalMessages & { hub: hubs | null; broadcastMsgs: broadcastedMessages[] },
    locale: supportedLocaleCodes,
  ) {
    if (!originalMsg.hubId) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'hub.notFound_mod', locale }, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    const server = await interaction.client.fetchGuild(originalMsg.serverId);
    if (!server) {
      await this.replyEmbed(
        interaction,
        t({ phrase: 'errors.unknownServer', locale }, { emoji: emojis.no }),
        { ephemeral: true },
      );
      return;
    }

    const { serverBlacklists } = interaction.client;
    const { reason, expires } = this.getModalData(interaction);

    await serverBlacklists.addBlacklist(
      { name: server?.name ?? 'Unknown Server', id: originalMsg.serverId },
      originalMsg.hubId,
      {
        reason,
        moderatorId: interaction.user.id,
        expires,
      },
    );

    // Notify server of blacklist
    await serverBlacklists.sendNotification({
      target: { id: originalMsg.serverId },
      hubId: originalMsg.hubId,
      expires,
      reason,
    });

    await deleteConnections({ serverId: originalMsg.serverId, hubId: originalMsg.hubId });

    if (server) {
      await logBlacklist(originalMsg.hubId, interaction.client, {
        target: server.id,
        mod: interaction.user,
        reason,
        expires,
      }).catch(() => null);
    }

    const successEmbed = this.buildSuccessEmbed(reason, expires, locale).setDescription(
      t(
        { phrase: 'blacklist.server.success', locale },
        { server: server?.name ?? 'Unknown Server', emoji: emojis.tick },
      ),
    );
    await interaction.editReply({ embeds: [successEmbed], components: [] });
  }

  // utils

  private async isBlacklisted(
    id: Snowflake,
    hubId: string,
    manager: UserDbManager | ServerBlacklisManager,
  ) {
    const isBlacklisted = await manager.fetchBlacklist(hubId, id);
    return Boolean(isBlacklisted);
  }

  private getModalData(interaction: ModalSubmitInteraction) {
    const reason = interaction.fields.getTextInputValue('reason');
    const duration = parse(interaction.fields.getTextInputValue('duration'));
    const expires = duration ? new Date(Date.now() + duration) : null;

    return { reason, expires };
  }

  private buildButtons(
    interaction: Interaction,
    messageId: Snowflake,
    isUserBlacklisted: boolean,
    isServerBlacklisted: boolean,
  ) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          new CustomID('blacklist:user', [interaction.user.id, messageId])
            .setExpiry(new Date(Date.now() + 60_000))
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.user_icon)
        .setDisabled(isUserBlacklisted),
      new ButtonBuilder()
        .setCustomId(
          new CustomID('blacklist:server', [interaction.user.id, messageId])
            .setExpiry(new Date(Date.now() + 60_000))
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.globe_icon)
        .setDisabled(isServerBlacklisted),
    );
  }

  private buildSuccessEmbed(reason: string, expires: Date | null, locale: supportedLocaleCodes) {
    return new EmbedBuilder().setColor('Green').addFields(
      {
        name: 'Reason',
        value: reason ? reason : t({ phrase: 'misc.noReason', locale }),
        inline: true,
      },
      {
        name: 'Expires',
        value: expires ? `${time(Math.round(expires.getTime() / 1000), 'R')}` : 'Never.',
        inline: true,
      },
    );
  }
  private async fetchMessageFromDb(
    messageId: string,
    include: { hub: boolean; broadcastMsgs: boolean } = { hub: false, broadcastMsgs: false },
  ) {
    let messageInDb = await db.originalMessages.findFirst({
      where: { messageId },
      include,
    });

    if (!messageInDb) {
      const broadcastedMsg = await db.broadcastedMessages.findFirst({
        where: { messageId },
        include: { originalMsg: { include } },
      });

      messageInDb = broadcastedMsg?.originalMsg ?? null;
    }

    return messageInDb;
  }
}
