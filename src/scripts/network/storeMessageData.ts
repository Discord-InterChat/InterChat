import { updateConnections } from '#main/utils/ConnectedList.js';
import { ConnectionMode, RedisKeys } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import Logger from '#main/utils/Logger.js';
import cacheClient from '#main/utils/cache/cacheClient.js';
import { originalMessages } from '@prisma/client';
import { APIMessage, Message } from 'discord.js';

interface ErrorResult {
  webhookURL: string;
  error: string;
}

interface SendResult {
  messageRes: APIMessage;
  mode: ConnectionMode;
  webhookURL: string;
}

export type NetworkWebhookSendResult = ErrorResult | SendResult;

/**
 * Stores message data in the database and updates the connectedList based on the webhook status.
 * @param channelAndMessageIds The result of sending the message to multiple channels.
 * @param hubId The ID of the hub to connect the message data to.
 */
export default async (
  message: Message,
  broadcastResults: NetworkWebhookSendResult[],
  hubId: string,
  mode: ConnectionMode,
  dbReference?: originalMessages | null,
) => {
  const messageDataObj: {
    channelId: string;
    messageId: string;
    createdAt: Date;
    mode: ConnectionMode;
  }[] = [];

  const invalidWebhookURLs: string[] = [];
  const validErrors = ['Invalid Webhook Token', 'Unknown Webhook', 'Missing Permissions'];

  // loop through all results and extract message data and invalid webhook urls
  broadcastResults.forEach((res) => {
    if ('error' in res) {
      if (!validErrors.some((e) => res.error.includes(e))) return;

      Logger.info('%O', res.error); // TODO Remove dis
      invalidWebhookURLs.push(res.webhookURL);
      return;
    }

    messageDataObj.push({
      channelId: res.messageRes.channel_id,
      messageId: res.messageRes.id,
      createdAt: new Date(res.messageRes.timestamp),
      mode: res.mode,
    });
  });

  if (hubId && messageDataObj.length > 0) {
    if (!message.inGuild()) return;

    // store message data in db
    await db.originalMessages.create({
      data: {
        mode,
        messageId: message.id,
        authorId: message.author.id,
        serverId: message.guildId,
        messageReference: dbReference?.messageId,
        createdAt: message.createdAt,
        reactions: {},
        broadcastMsgs: { createMany: { data: messageDataObj } },
        hub: { connect: { id: hubId } },
      },
    });
  }

  // store message timestamps to push to db later
  await cacheClient.set(
    `${RedisKeys.msgTimestamp}:${message.channelId}`,
    JSON.stringify({
      channelId: message.channelId,
      timestamp: message.createdTimestamp,
    }),
  );

  // disconnect network if, webhook does not exist/bot cannot access webhook
  if (invalidWebhookURLs.length > 0) {
    await updateConnections({ webhookURL: { in: invalidWebhookURLs } }, { connected: false });
  }
};
