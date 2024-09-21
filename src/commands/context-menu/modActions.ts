import { emojis } from '#main/config/Constants.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import handleBan from '#main/utils/banUtls/handleBan.js';
import { deleteConnections } from '#main/utils/ConnectedList.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { logBlacklist } from '#main/utils/HubLogger/ModLogs.js';
import { t, type supportedLocaleCodes } from '#main/utils/Locale.js';
import Logger from '#main/utils/Logger.js';
import { deleteMessageFromHub, isDeleteInProgress } from '#main/utils/moderation/deleteMessage.js';
import { isBlacklisted } from '#main/utils/moderator/blacklistUtils.js';
import modActionsPanel, { ModActionsDbMsgT } from '#main/utils/moderator/modActionsPanel.js';
import { isStaffOrHubMod } from '#main/utils/Utils.js';
import { Prisma } from '@prisma/client';
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonInteraction,
  EmbedBuilder,
  ModalBuilder,
  RepliableInteraction,
  Snowflake,
  TextInputBuilder,
  TextInputStyle,
  time,
  type MessageContextMenuCommandInteraction,
  type ModalSubmitInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import parse from 'parse-duration';

export default class Blacklist extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Moderation Actions',
    dm_permission: false,
  };

  async execute(interaction: MessageContextMenuCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const { userManager } = interaction.client;
    const dbUser = await userManager.getUser(interaction.user.id);
    const locale = await userManager.getUserLocale(dbUser);

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
        '<a:nuhuh:1256859727158050838> Nuh uh! You can\'t moderate your own messages.',
      );
      return;
    }

    const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg);
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
      await this.handleDeleteMessage(interaction, originalMsgId, locale);
      return;
    }
    else if (customId.suffix === 'banUser') {
      await this.handleBanButton(interaction, originalMsgId, locale);
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
  async handleBlacklistModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferUpdate();

    const customId = CustomID.parseCustomId(interaction.customId);
    const [originalMsgId] = customId.args;
    const originalMsg = await this.fetchMessageFromDb(originalMsgId);
    const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

    if (!originalMsg?.hubId) {
      await this.replyWithUnknownMessage(interaction, locale);
      return;
    }

    const blacklistType = customId.suffix === 'blacklistUser' ? 'user' : 'server';
    const idToBlacklist = blacklistType === 'user' ? originalMsg.authorId : originalMsg.serverId;
    const manager =
      blacklistType === 'user'
        ? interaction.client.userManager
        : interaction.client.serverBlacklists;

    if (await isBlacklisted(idToBlacklist, originalMsg.hubId, manager)) {
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

  async handleDeleteMessage(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    const originalMsg = await this.fetchMessageFromDb(originalMsgId, {
      broadcastMsgs: true,
    });

    if (!originalMsg?.hubId || !originalMsg.broadcastMsgs) {
      await this.replyWithUnknownMessage(interaction, locale);
      return;
    }

    const deleteInProgress = await isDeleteInProgress(originalMsg.messageId);
    if (deleteInProgress) {
      const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg);
      await interaction.update({ embeds: [embed], components: [buttons] });

      await this.replyEmbed(
        interaction,
        `${emojis.neutral} This message is already deleted or is being deleted by another moderator.`,
        { ephemeral: true },
      );
      return;
    }

    await interaction.reply({
      content: `${emojis.loading} Deleting messages... This may take a minute or so.`,
      ephemeral: true,
    });

    const { deletedCount } = await deleteMessageFromHub(
      originalMsg.hubId,
      originalMsg.messageId,
      originalMsg.broadcastMsgs,
    );

    await interaction
      .editReply(
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

  private async handleBanButton(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    const originalMsg = await this.fetchMessageFromDb(originalMsgId);

    if (!originalMsg) {
      await this.replyWithUnknownMessage(interaction, locale);
      return;
    }

    const modal = new ModalBuilder()
      .setTitle('Ban User')
      .setCustomId(
        new CustomID().setIdentifier('userBanModal').addArgs(originalMsg.authorId).toString(),
      )
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('reason')
            .setPlaceholder('Breaking rules...')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500),
        ),
      );

    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('userBanModal')
  async handleBanModal(interaction: ModalSubmitInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [userId] = customId.args;

    const user = await interaction.client.users.fetch(userId).catch(() => null);
    const reason = interaction.fields.getTextInputValue('reason');

    await handleBan(interaction, userId, user, reason);
  }

  private async handleUserBlacklist(
    interaction: ModalSubmitInteraction,
    originalMsg: ModActionsDbMsgT,
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

    const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg);
    await interaction.editReply({ embeds: [embed], components: [buttons] });
    await interaction.followUp({ embeds: [successEmbed], components: [], ephemeral: true });
  }

  private async handleServerBlacklist(
    interaction: ModalSubmitInteraction,
    originalMsg: ModActionsDbMsgT,
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

    const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg);
    await interaction.editReply({ embeds: [embed], components: [buttons] });
    await interaction.followUp({ embeds: [successEmbed], components: [], ephemeral: true });
  }

  // utils
  private getModalData(interaction: ModalSubmitInteraction) {
    const reason = interaction.fields.getTextInputValue('reason');
    const duration = parse(interaction.fields.getTextInputValue('duration'));
    const expires = duration ? new Date(Date.now() + duration) : null;

    return { reason, expires };
  }

  private async replyWithUnknownMessage(
    interaction: RepliableInteraction,
    locale: supportedLocaleCodes,
    edit = false,
  ) {
    return await this.replyEmbed(
      interaction,
      t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      { edit, ephemeral: true },
    );
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
  ): Promise<ModActionsDbMsgT | null> {
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
}
