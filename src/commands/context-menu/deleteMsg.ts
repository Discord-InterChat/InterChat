import {
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import db from '../../utils/Db.js';
import BaseCommand from '../../core/BaseCommand.js';
import { checkIfStaff } from '../../utils/Utils.js';
import { REGEX, emojis } from '../../utils/Constants.js';
import { t } from '../../utils/Locale.js';
import { logMsgDelete } from '../../utils/HubLogger/ModLogs.js';
import { captureException } from '@sentry/node';
import { getAllConnections } from '../../utils/ConnectedList.js';

export default class DeleteMessage extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    type: ApplicationCommandType.Message,
    name: 'Delete Message',
    dm_permission: false,
  };

  readonly cooldown = 10_000;

  async execute(interaction: MessageContextMenuCommandInteraction): Promise<void> {
    const isOnCooldown = await this.checkAndSetCooldown(interaction);
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

    if (!originalMsg?.hub) {
      await interaction.editReply(
        t(
          {
            phrase: 'errors.unknownNetworkMessage',
            locale: interaction.user.locale,
          },
          { emoji: emojis.no },
        ),
      );
      return;
    }

    const { hub } = originalMsg;

    const isHubMod =
      hub?.moderators.some((mod) => mod.userId === interaction.user.id) ||
      hub.ownerId === interaction.user.id;

    const isStaffOrHubMod = checkIfStaff(interaction.user.id) || isHubMod;

    if (!isStaffOrHubMod && interaction.user.id !== originalMsg.authorId) {
      await interaction.editReply(
        t(
          {
            phrase: 'errors.notMessageAuthor',
            locale: interaction.user.locale,
          },
          { emoji: emojis.no },
        ),
      );
      return;
    }

    await interaction.editReply(
      `${emojis.yes} Your request has been queued. Messages will be deleted shortly...`,
    );

    let passed = 0;

    const allConnections = await getAllConnections();

    for await (const dbMsg of originalMsg.broadcastMsgs) {
      const connection = allConnections?.find((c) => c.channelId === dbMsg.channelId);

      if (!connection) break;

      const webhookURL = connection.webhookURL.split('/');
      const webhook = await interaction.client
        .fetchWebhook(webhookURL[webhookURL.length - 2])
        ?.catch(() => null);

      if (webhook?.owner?.id !== interaction.client.user?.id) break;

      // finally, delete the message
      await webhook
        ?.deleteMessage(dbMsg.messageId, connection.parentId ? connection.channelId : undefined)
        .catch(() => null);
      passed++;
    }

    await interaction
      .editReply(
        t(
          {
            phrase: 'network.deleteSuccess',
            locale: interaction.user.locale,
          },
          {
            emoji: emojis.yes,
            user: `<@${originalMsg.authorId}>`,
            deleted: passed.toString(),
            total: originalMsg.broadcastMsgs.length.toString(),
          },
        ),
      )
      .catch(() => null);

    const { targetMessage } = interaction;

    const messageContent =
      targetMessage.cleanContent ?? targetMessage.embeds.at(0)?.description?.replaceAll('`', '`');

    const imageUrl =
      targetMessage.embeds.at(0)?.image?.url ?? targetMessage.content.match(REGEX.IMAGE_URL)?.at(0);

    if (isStaffOrHubMod && messageContent) {
      await logMsgDelete(interaction.client, messageContent, hub, {
        userId: originalMsg.authorId,
        serverId: originalMsg.serverId,
        modName: interaction.user.username,
        imageUrl,
      }).catch(captureException);
    }
  }
}
