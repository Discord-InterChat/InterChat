import BaseCommand from '#main/core/BaseCommand.js';
import Constants, { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { logMsgDelete } from '#main/utils/HubLogger/ModLogs.js';
import { t } from '#main/utils/Locale.js';
import {
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { isStaffOrHubMod } from '#main/utils/hub/utils.js';
import { deleteMessageFromHub, isDeleteInProgress } from '#main/utils/moderation/deleteMessage.js';
import { originalMessages, hubs, broadcastedMessages } from '@prisma/client';

type OriginalMsgT = originalMessages & { hub: hubs; broadcastMsgs: broadcastedMessages[] };

export default class DeleteMessage extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Delete Message',
    dm_permission: false,
  };

  readonly cooldown = 10_000;

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    if ((await this.checkOrSetCooldown(interaction)) || !interaction.inCachedGuild()) return;

    await interaction.deferReply({ ephemeral: true });

    const originalMsg = await this.getOriginalMessage(interaction.targetId);
    if (!(await this.validateMessage(interaction, originalMsg))) return;

    await this.processMessageDeletion(interaction, originalMsg as OriginalMsgT);
  }

  private async getOriginalMessage(messageId: string) {
    const originalMsg = await db.originalMessages.findFirst({
      where: { messageId },
      include: { hub: true, broadcastMsgs: true },
    });

    if (originalMsg) return originalMsg;

    const broadcastedMsg = await db.broadcastedMessages.findFirst({
      where: { messageId },
      include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
    });

    return broadcastedMsg?.originalMsg ?? null;
  }

  private async processMessageDeletion(
    interaction: MessageContextMenuCommandInteraction,
    originalMsg: OriginalMsgT,
  ): Promise<void> {
    const { hub } = originalMsg;
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    await interaction.editReply(
      `${emojis.yes} Your request has been queued. Messages will be deleted shortly...`,
    );

    const { deletedCount } = await deleteMessageFromHub(
      hub.id,
      originalMsg.messageId,
      originalMsg.broadcastMsgs,
    );

    await interaction
      .editReply(
        t(
          { phrase: 'network.deleteSuccess', locale },
          {
            emoji: emojis.yes,
            user: `<@${originalMsg.authorId}>`,
            deleted: `${deletedCount}`,
            total: `${originalMsg.broadcastMsgs.length}`,
          },
        ),
      )
      .catch(() => null);

    await this.logDeletion(interaction, hub, originalMsg);
  }

  private async validateMessage(
    interaction: MessageContextMenuCommandInteraction,
    originalMsg:
      | (originalMessages & { hub: hubs | null; broadcastMsgs: broadcastedMessages[] })
      | null,
  ): Promise<boolean> {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (!originalMsg?.hub) {
      await interaction.editReply(
        t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      );
      return false;
    }

    if (await isDeleteInProgress(originalMsg.messageId)) {
      await this.replyEmbed(
        interaction,
        `${emojis.neutral} This message is already deleted or is being deleted by another moderator.`,
        { ephemeral: true, edit: true },
      );
      return false;
    }

    if (
      interaction.user.id !== originalMsg.authorId &&
      !isStaffOrHubMod(interaction.user.id, originalMsg.hub)
    ) {
      await interaction.editReply(
        t({ phrase: 'errors.notMessageAuthor', locale }, { emoji: emojis.no }),
      );
      return false;
    }

    return true;
  }

  private async logDeletion(
    interaction: MessageContextMenuCommandInteraction,
    hub: hubs,
    originalMsg: OriginalMsgT,
  ): Promise<void> {
    if (!isStaffOrHubMod(interaction.user.id, hub)) return;

    const { targetMessage } = interaction;
    const messageContent =
      targetMessage.cleanContent ?? targetMessage.embeds.at(0)?.description?.replaceAll('`', '\\`');

    if (!messageContent) return;

    const imageUrl =
      targetMessage.embeds.at(0)?.image?.url ??
      targetMessage.content.match(Constants.Regex.ImageURL)?.[0];

    await logMsgDelete(interaction.client, messageContent, hub, {
      userId: originalMsg.authorId,
      serverId: originalMsg.serverId,
      modName: interaction.user.username,
      imageUrl,
    });
  }
}
