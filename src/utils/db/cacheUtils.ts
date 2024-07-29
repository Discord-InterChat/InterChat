import { Prisma } from '@prisma/client';
import db from '../Db.js';
import Logger from '../Logger.js';

export const getCacheKey = (prefix: string, id: string) => `${prefix}:${id}`;

export const cacheData = async (key: string, value: string, model: Prisma.ModelName) => {
  // expires after 1 hour
  await db.cache.set(getCacheKey(model, key), value, 'EX', 3600).catch((e) => {
    Logger.error('Failed to set cache: ', e);
  });
};

export const parseKey = (key: string) => {
  const [id, model] = key.split(':');
  return { id, model } as { id: string; model: Prisma.ModelName };
};

export const invalidateCacheForModel = async (model: string) => {
  const allCacheKeys = await db.cache.keys('*');
  allCacheKeys.forEach(async (key) => {
    if (parseKey(key).model === model) {
      await db.cache.del(getCacheKey(model, key));
    }
  });
};

export function serializeCache<K>(data: string | null): K | null;
export function serializeCache<K>(data: string | (string | null)[] | null): K[] | null;
export function serializeCache(data: string | (string | null)[] | null) {
  if (!data) return null;

  if (!Array.isArray(data)) return JSON.parse(data);
  else if (data.length > 0) return data.map((v) => (v ? JSON.parse(v) : undefined)).filter(Boolean);
  return null;
}

export const traverseCursor = async (
  result: [cursor: string, elements: string[]],
  match: string,
  start: number,
) => {
  const cursor = parseInt(result[0]);
  if (Number.isNaN(cursor) || cursor === 0) return result;

  const _newRes = await db.cache.scan(start, 'MATCH', match, 'COUNT', cursor);

  result[0] = _newRes[0];
  result[1].push(..._newRes[1]);
  return result;
};

export async function getAllDocuments(match: string) {
  const firstIter = await db.cache.scan(0, 'MATCH', match, 'COUNT', 100);
  const keys = (await traverseCursor(firstIter, match, 100))[1];
  const result = (await Promise.all(keys.map(async (key) => await db.cache.get(key)))).filter(
    Boolean,
  ) as string[];
  return result;
}

export const getCachedData = async <T extends object>(
  key: string,
  fetchFunction: () => Promise<T | null>,
) => {
  // Check cache first
  const cachedData = serializeCache<T>(await db.cache.get(key));
  if (cachedData) return cachedData;

  const parsedKey = parseKey(key);

  // If not in cache, fetch from source (e.g., MongoDB)
  const data = await fetchFunction();

  // Store in cache with TTL
  await cacheData(key, JSON.stringify(data), parsedKey.model);

  return data;
};
