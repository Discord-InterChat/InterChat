import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import ServerBlacklisManager from '#main/modules/ServerBlacklistManager.js';
import UserDbManager from '#main/modules/UserDbManager.js';
import {
  deleteMessageFromHub,
  isDeleteInProgress,
} from '#main/scripts/deleteMessage/deleteMessage.js';
import { deleteConnections } from '#main/utils/ConnectedList.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { logBlacklist } from '#main/utils/HubLogger/ModLogs.js';
import { t, type supportedLocaleCodes } from '#main/utils/Locale.js';
import Logger from '#main/utils/Logger.js';
import { isStaffOrHubMod } from '#main/utils/Utils.js';
import { broadcastedMessages, hubs, originalMessages, Prisma } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  Interaction,
  ModalBuilder,
  Snowflake,
  TextInputBuilder,
  TextInputStyle,
  time,
  type MessageContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import parse from 'parse-duration';

type DbMessageT = originalMessages & { hub?: hubs | null; broadcastMsgs?: broadcastedMessages[] };

export default class Blacklist extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Moderation Actions',
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

    // if (originalMsg.authorId === interaction.user.id) {
    //   await interaction.editReply(
    //     '<a:nuhuh:1256859727158050838> Nuh uh! You can\'t moderate your own messages.',
    //   );
    //   return;
    // }

    const { embed, buttons } = await this.buildMessage(interaction, originalMsg);
    await interaction.editReply({ embeds: [embed], components: [buttons] });
  }

  @RegisterInteractionHandler('modMessage')
  async handleButtons(interaction: ButtonInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
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

    if (customId.suffix === 'deleteMsg') {
      await this.handleDeleteMessage(interaction, originalMsgId);
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
    const [originalMsgId] = customId.args;
    const originalMsg = await this.fetchMessageFromDb(originalMsgId);
    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

    if (!originalMsg?.hubId) {
      await interaction.editReply(
        t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      );
      return;
    }

    const blacklistType = customId.suffix === 'blacklistUser' ? 'user' : 'server';
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

    if (customId.suffix === 'blacklistUser') {
      await this.handleUserBlacklist(interaction, originalMsg, locale);
    }
    else {
      await this.handleServerBlacklist(interaction, originalMsg, locale);
    }
  }

  async handleDeleteMessage(interaction: ButtonInteraction, originalMsgId: Snowflake) {
    const originalMsg = await this.fetchMessageFromDb(originalMsgId, {
      broadcastMsgs: true,
    });

    if (!originalMsg?.hubId || !originalMsg.broadcastMsgs) {
      await this.replyEmbed(interaction, 'This message no longer exists.', { ephemeral: true });
      return;
    }

    const deleteInProgress = await isDeleteInProgress(originalMsg.messageId);
    if (deleteInProgress) {
      await this.replyEmbed(
        interaction,
        `${emojis.neutral} This message is already deleted or is being deleted by another moderator.`,
        { ephemeral: true },
      );
      return;
    }

    const { deletedCount } = await deleteMessageFromHub(
      originalMsg.hubId,
      originalMsg.messageId,
      originalMsg.broadcastMsgs,
    );

    const { embed, buttons } = await this.buildMessage(interaction, originalMsg);
    await interaction.update({ embeds: [embed], components: [buttons] });
    const initialReply = await interaction.followUp({
      content: `${emojis.loading} Deleting messages... This may take a minute or so.`,
      ephemeral: true,
    });

    await initialReply
      .edit(
        t(
          {
            phrase: 'network.deleteSuccess',
            locale: await interaction.client.userManager.getUserLocale(interaction.user.id),
          },
          {
            emoji: emojis.yes,
            user: `<@${originalMsg.authorId}>`,
            deleted: `${deletedCount}`,
            total: `${originalMsg.broadcastMsgs.length}`,
          },
        ),
      )
      .catch(() => null);
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
    const successEmbed = this.buildSuccessEmbed(reason, expires, locale).setDescription(
      t(
        { phrase: 'blacklist.user.success', locale },
        { username: user?.username ?? 'Unknown User', emoji: emojis.tick },
      ),
    );

    const { userManager } = interaction.client;
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

    const { embed, buttons } = await this.buildMessage(interaction, originalMsg);

    await interaction.editReply({ embeds: [embed], components: [buttons] });
    await interaction.followUp({ embeds: [successEmbed], components: [], ephemeral: true });
  }

  private async handleServerBlacklist(
    interaction: ModalSubmitInteraction,
    originalMsg: DbMessageT,
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

    const { embed, buttons } = await this.buildMessage(interaction, originalMsg);

    await interaction.editReply({ embeds: [embed], components: [buttons] });
    await interaction.followUp({ embeds: [successEmbed], components: [], ephemeral: true });
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
    opts: { isUserBlacklisted: boolean; isServerBlacklisted: boolean; isDeleteInProgress: boolean },
  ) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          new CustomID('modMessage:blacklistUser', [interaction.user.id, messageId])
            .setExpiry(new Date(Date.now() + 60_000))
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.user_icon)
        .setDisabled(opts.isUserBlacklisted),
      new ButtonBuilder()
        .setCustomId(
          new CustomID('modMessage:blacklistServer', [interaction.user.id, messageId])
            .setExpiry(new Date(Date.now() + 60_000))
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.globe_icon)
        .setDisabled(opts.isServerBlacklisted),
      new ButtonBuilder()
        .setCustomId(
          new CustomID('modMessage:deleteMsg', [interaction.user.id, messageId])
            .setExpiry(new Date(Date.now() + 60_000))
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.deleteDanger_icon)
        .setDisabled(opts.isDeleteInProgress),
    );
  }

  private buildInfoEmbed(
    username: string,
    servername: string,
    opts: { isUserBlacklisted: boolean; isServerBlacklisted: boolean; isDeleteInProgress: boolean },
  ) {
    const userEmbedDesc = opts.isUserBlacklisted
      ? `~~User **${username}** is already blacklisted.~~`
      : `Blacklist user **${username}** from this hub.`;

    const serverEmbedDesc = opts.isServerBlacklisted
      ? `Blacklist server **${servername}** from this hub.`
      : `~~Server **${servername}** is already blacklisted.~~`;

    const deleteDesc = opts.isDeleteInProgress
      ? 'Message is already deleted or is being deleted.'
      : 'Delete this message from all connections.';

    return new EmbedBuilder().setColor(Constants.Colors.invisible).setFooter({
      text: 'Target will be notified of the blacklist. Use /blacklist list to view all blacklists.',
    }).setDescription(stripIndents`
          ### ${emojis.timeout_icon} Moderation Actions
          **${emojis.user_icon} Blacklist User**: ${userEmbedDesc}
          **${emojis.globe_icon} Blacklist Server**: ${serverEmbedDesc}
          **${emojis.deleteDanger_icon} Delete Message**: ${deleteDesc}
      `);
  }

  private buildSuccessEmbed(reason: string, expires: Date | null, locale: supportedLocaleCodes) {
    return new EmbedBuilder().setColor('Green').addFields(
      {
        name: 'Reason',
        value: reason ?? t({ phrase: 'misc.noReason', locale }),
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
    include: Prisma.originalMessagesInclude = { hub: false, broadcastMsgs: false },
  ): Promise<DbMessageT | null> {
    let messageInDb = await db.originalMessages.findFirst({ where: { messageId }, include });

    if (!messageInDb) {
      const broadcastedMsg = await db.broadcastedMessages.findFirst({
        where: { messageId },
        include: { originalMsg: { include } },
      });

      messageInDb = broadcastedMsg?.originalMsg ?? null;
    }

    return messageInDb;
  }

  private async buildMessage(interaction: Interaction, originalMsg: DbMessageT) {
    const user = await interaction.client.users.fetch(originalMsg.authorId);
    const server = await interaction.client.fetchGuild(originalMsg.serverId);
    const deleteInProgress = await isDeleteInProgress(originalMsg.messageId);

    const isUserBlacklisted = await this.isBlacklisted(
      originalMsg.authorId,
      `${originalMsg.hubId}`,
      interaction.client.userManager,
    );
    const isServerBlacklisted = await this.isBlacklisted(
      originalMsg.serverId,
      `${originalMsg.hubId}`,
      interaction.client.serverBlacklists,
    );

    const embed = this.buildInfoEmbed(user.username, server?.name ?? 'Unknown Server', {
      isUserBlacklisted,
      isServerBlacklisted,
      isDeleteInProgress: deleteInProgress,
    });

    const buttons = this.buildButtons(interaction, originalMsg.messageId, {
      isUserBlacklisted,
      isServerBlacklisted,
      isDeleteInProgress: deleteInProgress,
    });

    return { embed, buttons };
  }
}
