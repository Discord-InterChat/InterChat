import { RedisKeys } from '#main/config/Constants.js';
import getRedis from '#main/utils/Redis.js';
import type { Message, Snowflake } from 'discord.js';
import isEmpty from 'lodash/isEmpty.js';

export interface OriginalMessage {
  mode: number;
  hubId: string;
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

  await redis.hset(key, messageData);
  await redis.expire(key, 86400); // 1 day in seconds
};

export const getOriginalMessage = async (originalMsgId: string) => {
  const key = `${RedisKeys.message}:${originalMsgId}`;
  const res = (await getRedis().hgetall(key)) as unknown as OriginalMessage;

  if (isEmpty(res)) return null;

  return res;
};

export const addBroadcasts = async (
  hubId: string,
  originalMsgId: Snowflake,
  ...broadcasts: Broadcast[]
) => {
  const redis = getRedis();
  const broadcastsKey = `${RedisKeys.broadcasts}:${originalMsgId}:${hubId}`;

  // Single loop to process all broadcast data
  const { broadcastEntries, reverseLookups } = broadcasts.reduce(
    (acc, broadcast) => {
      const { messageId, channelId, mode } = broadcast;
      const broadcastInfo = JSON.stringify({ mode, messageId, channelId, originalMsgId });

      // Add to broadcasts hash
      acc.broadcastEntries.push(channelId, broadcastInfo);

      // Prepare reverse lookup
      acc.reverseLookups.push(
        `${RedisKeys.messageReverse}:${messageId}`,
        `${originalMsgId}:${hubId}`,
      );

      return acc;
    },
    { broadcastEntries: [] as string[], reverseLookups: [] as string[] },
  );

  // Add all broadcasts to the hash in a single operation
  await redis
    .multi()
    .hset(broadcastsKey, broadcastEntries)
    .expire(broadcastsKey, 86400)
    .mset(reverseLookups)
    .exec();

  reverseLookups
    .filter((_, i) => i % 2 === 0)
    .forEach(async (key) => {
      await redis.expire(key, 86400);
    });
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
  await getRedis().hset(`${RedisKeys.msgTimestamp}`, message.channelId, message.createdTimestamp);
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
