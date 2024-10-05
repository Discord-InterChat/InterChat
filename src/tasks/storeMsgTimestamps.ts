import { RedisKeys } from '#main/config/Constants.js';
import { cacheData, getCachedData } from '#main/utils/cache/cacheUtils.js';
import { updateConnection } from '#main/utils/ConnectedListUtils.js';
import Logger from '#main/utils/Logger.js';

const getTimestamps = async () => {
  const fetched = await getCachedData(`${RedisKeys.msgTimestamp}:all`);
  return (fetched.data ?? []) as { channelId: string; timestamp: number }[];
};

const refreshCache = async (channelIdsToRemove: string[]) => {
  const arr = await getTimestamps();
  if (arr.length === 0) return;

  const updated = arr.filter((item) => !channelIdsToRemove.includes(item.channelId));
  await cacheData(`${RedisKeys.msgTimestamp}:all`, JSON.stringify(updated));
};

export default async () => {
  const arr = await getTimestamps();
  if (arr.length === 0) return;

  arr.forEach(async ({ channelId, timestamp }, index) => {
    await updateConnection({ channelId }, { lastActive: new Date(timestamp) });
    Logger.debug(`Stored message timestamps for channel ${channelId} from cache to db.`);
    if (index === arr.length - 1) await refreshCache(arr.map((item) => item.channelId));
  });
};
