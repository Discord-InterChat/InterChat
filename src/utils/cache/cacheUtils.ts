import { RedisKeys } from '#main/config/Constants.js';
import cacheClient from '#main/utils/cache/cacheClient.js';
import Logger from '#main/utils/Logger.js';
import { Prisma } from '@prisma/client';
import { type Awaitable } from 'discord.js';

// TODO: make this into a class

export const cacheData = async (key: string, value: string, expirySecs?: number) => {
  try {
    return await cacheClient.set(key, value, 'EX', expirySecs ?? 5 * 60);
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
  const allCacheKeys = await cacheClient.keys('*');
  allCacheKeys.forEach(async (key) => {
    if (parseKey(key).model === model) {
      await cacheClient.del(`${model}:${key}`);
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

export const traverseCursor = async (
  result: [cursor: string, elements: string[]],
  match: string,
  start: number,
): Promise<[cursor: string, elements: string[]]> => {
  const cursor = parseInt(result[0]);
  if (isNaN(cursor) || cursor === 0) return result;

  const newRes = await cacheClient.scan(start, 'MATCH', match, 'COUNT', 100);

  result[0] = newRes[0];
  result[1].push(...newRes[1]);

  if (newRes[0] !== '0') return await traverseCursor(result, match, start);
  return result;
};

export const getAllDocuments = async (match: string) => {
  const firstIter = await cacheClient.scan(0, 'MATCH', match, 'COUNT', 100);
  const keys = (await traverseCursor(firstIter, match, 100))[1];
  const result = (await Promise.all(keys.map(async (key) => await cacheClient.get(key)))).filter(
    Boolean,
  ) as string[];
  return result;
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
  let data = serializeCache<T>(await cacheClient.get(key));
  const fromCache = isCacheable(data);

  if (!fromCache && fetchFunction) {
    data = (await fetchFunction()) as ConvertDatesToString<T>;
    if (isCacheable(data)) await cacheData(key, JSON.stringify(data), expiry);
  }

  return { data, fromCache };
};
