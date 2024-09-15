import BaseCommand from '#main/core/BaseCommand.js';
import {
  deleteMessageFromAllNetworks,
  isDeleteInProgress,
} from '#main/scripts/deleteMessage/deleteMessage.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { logMsgDelete } from '#main/utils/HubLogger/ModLogs.js';
import { t } from '#main/utils/Locale.js';
import { isStaffOrHubMod } from '#main/utils/Utils.js';
import {
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';

export default class DeleteMessage extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Delete Message',
    dm_permission: false,
  };

  readonly cooldown = 10_000;

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    const isOnCooldown = await this.checkOrSetCooldown(interaction);
    if (isOnCooldown || !interaction.inCachedGuild()) return;

    await interaction.deferReply({ ephemeral: true });

    let originalMsg = await db.originalMessages.findFirst({
      where: { messageId: interaction.targetId },
      include: { hub: true, broadcastMsgs: true },
    });

    if (!originalMsg) {
      const broadcastedMsg = await db.broadcastedMessages.findFirst({
        where: { messageId: interaction.targetId },
        include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
      });

      originalMsg = broadcastedMsg?.originalMsg ?? null;
    }

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    if (!originalMsg?.hub) {
      await interaction.editReply(
        t({ phrase: 'errors.unknownNetworkMessage', locale }, { emoji: emojis.no }),
      );
      return;
    }

    if (await isDeleteInProgress(originalMsg.messageId)) {
      await this.replyEmbed(
        interaction,
        `${emojis.neutral} This message is already in-progress of being deleted.`,
        { ephemeral: true },
      );
      return;
    }

    const { hub } = originalMsg;

    if (
      interaction.user.id !== originalMsg.authorId &&
      !isStaffOrHubMod(interaction.user.id, hub)
    ) {
      await interaction.editReply(
        t({ phrase: 'errors.notMessageAuthor', locale }, { emoji: emojis.no }),
      );
      return;
    }

    await interaction.editReply(
      `${emojis.yes} Your request has been queued. Messages will be deleted shortly...`,
    );

    // delete the message
    const { deletedCount } = await deleteMessageFromAllNetworks(
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

    const { targetMessage } = interaction;

    const messageContent =
      targetMessage.cleanContent ?? targetMessage.embeds.at(0)?.description?.replaceAll('`', '\\`');

    const imageUrl =
      targetMessage.embeds.at(0)?.image?.url ??
      targetMessage.content.match(Constants.Regex.ImageURL)?.at(0);

    if (isStaffOrHubMod(interaction.user.id, hub) && messageContent) {
      await logMsgDelete(interaction.client, messageContent, hub, {
        userId: originalMsg.authorId,
        serverId: originalMsg.serverId,
        modName: interaction.user.username,
        imageUrl,
      });
    }
  }
}
