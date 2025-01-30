import type { Message, Snowflake } from 'discord.js';
import isEmpty from 'lodash/isEmpty.js';
import Logger from '#src/utils/Logger.js';
import getRedis from '#src/utils/Redis.js';
import { handleError } from '#src/utils/Utils.js';
import Constants, { RedisKeys } from '#utils/Constants.js';

export interface OriginalMessage {
  hubId: string;
  content: string;
  imageUrl: string | null;
  messageId: string;
  guildId: string;
  authorId: string;
  timestamp: number;
  reactions?: { [key: string]: Snowflake[] };
  referredMessageId?: string;
}

export interface Broadcast {
  mode: number;
  messageId: string;
  channelId: string;
  originalMsgId: string;
}

export const storeMessage = async (originalMsgId: string, messageData: OriginalMessage) => {
  const key = `${RedisKeys.message}:${originalMsgId}`;
  const redis = getRedis();

  Logger.debug(`Storing message ${originalMsgId} in cache`);

  await redis.hset(key, messageData);
  await redis.expire(key, 86400); // 1 day in seconds
};

export const getOriginalMessage = async (originalMsgId: string) => {
  const key = `${RedisKeys.message}:${originalMsgId}`;
  const res = await getRedis().hgetall(key);

  if (isEmpty(res)) return null;

  return {
    ...res,
    timestamp: Number.parseInt(res.timestamp),
  } as OriginalMessage;
};

export const addBroadcasts = async (
  hubId: string,
  originalMsgId: Snowflake,
  ...broadcasts: Broadcast[]
) => {
  try {
    const redis = getRedis();
    const broadcastsKey = `${RedisKeys.broadcasts}:${originalMsgId}:${hubId}`;
    const pipeline = redis.pipeline();

    // Prepare all operations in a single reduce to minimize iterations
    const { broadcastEntries, reverseLookupKeys } = broadcasts.reduce(
      (acc, broadcast) => {
        const { messageId, channelId, mode } = broadcast;
        const broadcastInfo = JSON.stringify({
          mode,
          messageId,
          channelId,
          originalMsgId,
        });

        // Add to broadcasts entries
        acc.broadcastEntries.push(channelId, broadcastInfo);

        // Store reverse lookup key for later expiry setting
        const reverseKey = `${RedisKeys.messageReverse}:${messageId}`;
        acc.reverseLookupKeys.push(reverseKey);

        // Add reverse lookup to pipeline
        pipeline.set(reverseKey, `${originalMsgId}:${hubId}`);

        return acc;
      },
      {
        broadcastEntries: [] as string[],
        reverseLookupKeys: [] as string[],
      },
    );

    Logger.debug(`Adding ${broadcasts.length} broadcasts for message ${originalMsgId}`);

    // Add main broadcast hash
    pipeline.hset(broadcastsKey, broadcastEntries);
    pipeline.expire(broadcastsKey, 86400);

    // Set expiry for all reverse lookups in the same pipeline
    for (const key of reverseLookupKeys) {
      pipeline.expire(key, 86400);
    }

    // Execute all Redis operations in a single pipeline
    await pipeline.exec().catch((error) => {
      handleError(error, { comment: 'Failed to add broadcasts' });
    });

    Logger.debug(`Added ${broadcasts.length} broadcasts for message ${originalMsgId}`);
  }
  catch (error) {
    Logger.error('Failed to add broadcasts', error);
  }
};

export const getBroadcasts = async (originalMsgId: string, hubId: string) => {
  const key = `${RedisKeys.broadcasts}:${originalMsgId}:${hubId}`;
  const broadcasts = await getRedis().hgetall(key);
  const entries = Object.entries(broadcasts);

  // Parse the JSON strings back into objects
  return Object.fromEntries(entries.map(([k, v]) => [k, JSON.parse(v)])) as Record<
    string,
    Broadcast
  >;
};

export const getBroadcast = async (
  originalMsgId: string,
  hubId: string,
  find: { channelId: string },
) => {
  const broadcast = await getRedis().hget(
    `${RedisKeys.broadcasts}:${originalMsgId}:${hubId}`,
    find.channelId,
  );
  return broadcast ? (JSON.parse(broadcast) as Broadcast) : null;
};

export const findOriginalMessage = async (broadcastedMessageId: string) => {
  const reverseLookupKey = `${RedisKeys.messageReverse}:${broadcastedMessageId}`;
  const lookup = await getRedis().get(reverseLookupKey);

  if (!lookup) return null;
  const [originalMsgId] = lookup.split(':');

  return await getOriginalMessage(originalMsgId);
};

export const storeMessageTimestamp = async (message: Message) => {
  Logger.debug(`Storing message timestamp for channel ${message.channelId}`);
  await getRedis().hset(`${RedisKeys.msgTimestamp}`, message.channelId, message.createdTimestamp);
  Logger.debug(`Stored message timestamp for channel ${message.channelId}`);
};

export const deleteMessageCache = async (originalMsgId: Snowflake) => {
  const redis = getRedis();
  const original = await getOriginalMessage(originalMsgId);
  if (!original) return 0;

  // delete broadcats, reverse lookups and original message
  const broadcats = Object.values(await getBroadcasts(originalMsgId, original.hubId));
  await redis.del(`${RedisKeys.broadcasts}:${originalMsgId}:${original.hubId}`);
  await redis.del(broadcats.map((b) => `${RedisKeys.messageReverse}:${b.messageId}`)); // multi delete
  const count = await redis.del(`${RedisKeys.message}:${originalMsgId}`);

  return count;
};

export const getMessageIdFromStr = (str: string) => {
  const match = str.match(Constants.Regex.MessageLink)?.[3] ?? str.match(/(\d{17,19})/)?.[0];
  return match;
};
