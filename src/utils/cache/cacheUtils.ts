import { RedisKeys } from '#main/config/Constants.js';
import getRedis from '#utils/Redis.js';
import Logger from '#utils/Logger.js';
import { Prisma } from '@prisma/client';
import { type Awaitable } from 'discord.js';

// TODO: make this into a class

export const cacheData = async (key: string, value: string, expirySecs?: number) => {
  try {
    await getRedis().set(key, value, 'EX', expirySecs ?? 5 * 60);
  }
  catch (e) {
    Logger.error('Failed to set cache: ', e);
  }
};

export const parseKey = (key: string) => {
  const [id, model] = key.split(':');
  return { id, model } as { id: string; model: Prisma.ModelName };
};

export const invalidateCacheForModel = async (model: string) => {
  const redisClient = getRedis();
  const allCacheKeys = await redisClient.keys('*');
  allCacheKeys.forEach(async (key) => {
    if (parseKey(key).model === model) {
      await redisClient.del(`${model}:${key}`);
    }
  });
};

export const serializeCache = <K>(data: string | null): ConvertDatesToString<K> | null => {
  if (!data) return null;
  try {
    return JSON.parse(data);
  }
  catch (e) {
    Logger.error('Failed to parse cache data: ', e);
    return data as ConvertDatesToString<K>;
  }
};

const isCacheable = (data: unknown): boolean =>
  Array.isArray(data) ? data.length > 0 : data !== null && data !== undefined;

export const getCachedData = async <
  T extends { [key: string]: unknown } | { [key: string]: unknown }[],
>(
  key: `${RedisKeys}:${string}`,
  fetchFunction?: (() => Awaitable<T | null>) | null,
  expiry?: number,
) => {
  let data = serializeCache<T>(await getRedis().get(key));
  const fromCache = isCacheable(data);

  if (!fromCache && fetchFunction) {
    data = (await fetchFunction()) as ConvertDatesToString<T>;
    if (isCacheable(data)) await cacheData(key, JSON.stringify(data), expiry);
  }

  return { data, fromCache };
};
