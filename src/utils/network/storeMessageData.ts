import { updateConnections } from '#utils/ConnectedListUtils.js';
import { ConnectionMode, RedisKeys } from '#main/config/Constants.js';
import db from '#utils/Db.js';
import Logger from '#utils/Logger.js';
import getRedis from '#utils/Redis.js';
import { originalMessages } from '@prisma/client';
import { APIMessage, Message } from 'discord.js';
import { getCachedData } from '#utils/cache/cacheUtils.js';

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

const storeMessageTimestamp = async (message: Message) => {
  const { data: msgTimestampArr } = await getCachedData<{ channelId: string; timestamp: number }[]>(
    `${RedisKeys.msgTimestamp}:all`,
  );

  const data = JSON.stringify([
    ...(msgTimestampArr ?? []),
    { channelId: message.channelId, timestamp: message.createdTimestamp },
  ]);

  await getRedis().set(`${RedisKeys.msgTimestamp}:all`, data);
};

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
  const validErrors = [
    'Unknown Webhook',
    'Missing Permissions',
    'Invalid Webhook Token',
    'The provided webhook URL is not valid.',
  ];

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

  await storeMessageTimestamp(message);

  // disconnect network if, webhook does not exist/bot cannot access webhook
  if (invalidWebhookURLs.length > 0) {
    await updateConnections({ webhookURL: { in: invalidWebhookURLs } }, { connected: false });
  }
};
