import { originalMessages } from '@prisma/client';
import { APIMessage, Message } from 'discord.js';
import { parseTimestampFromId } from '../../utils/Utils.js';
import db from '../../utils/Db.js';

export interface NetworkWebhookSendResult {
  messageOrError: APIMessage | string;
  webhookURL: string;
}

/**
 * Stores message data in the database and updates the connectedList based on the webhook status.
 * @param channelAndMessageIds The result of sending the message to multiple channels.
 * @param hubId The ID of the hub to connect the message data to.
 */
export default async (
  message: Message,
  channelAndMessageIds: NetworkWebhookSendResult[],
  hubId: string,
  dbReference?: originalMessages | null,
) => {
  const messageDataObj: { channelId: string; messageId: string; createdAt: number }[] = [];
  const invalidWebhookURLs: string[] = [];
  const validErrors = ['Invalid Webhook Token', 'Unknown Webhook', 'Missing Permissions'];

  // loop through all results and extract message data and invalid webhook urls
  channelAndMessageIds.forEach((result) => {
    if (typeof result.messageOrError !== 'string') {
      messageDataObj.push({
        channelId: result.messageOrError.channel_id,
        messageId: result.messageOrError.id,
        createdAt: parseTimestampFromId(result.messageOrError.id),
      });
    }
    else if (validErrors.some((e) => (result.messageOrError as string).includes(e))) {
      invalidWebhookURLs.push(result.webhookURL);
    }
  });

  if (hubId && messageDataObj.length > 0) {
    if (!message.inGuild()) return;

    // store message data in db
    await db.originalMessages.create({
      data: {
        messageId: message.id,
        authorId: message.author.id,
        serverId: message.guild.id,
        messageReference: dbReference?.messageId,
        broadcastMsgs: { createMany: { data: messageDataObj } },
        hub: { connect: { id: hubId } },
        reactions: {},
      },
    });
  }

  // disconnect network if, webhook does not exist/bot cannot access webhook
  if (invalidWebhookURLs.length > 0) {
    await db.connectedList.updateMany({
      where: { webhookURL: { in: invalidWebhookURLs } },
      data: { connected: false },
    });
  }
};
