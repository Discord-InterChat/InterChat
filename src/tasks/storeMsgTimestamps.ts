import cacheClient from '#main/utils/cache/cacheClient.js';
import { updateConnection } from '#main/utils/ConnectedListUtils.js';
import { RedisKeys } from '#main/config/Constants.js';
import Logger from '#main/utils/Logger.js';
import { getAllDocuments, serializeCache } from '#main/utils/cache/cacheUtils.js';

export default async () => {
  const data = serializeCache<{ channelId: string; timestamp: number }>(
    await getAllDocuments('msgTimestamp:*'),
  );

  data?.forEach(async ({ timestamp, channelId }) => {
    await updateConnection({ channelId }, { lastActive: new Date(timestamp) });
    await cacheClient.del(`${RedisKeys.msgTimestamp}:${channelId}`);
    Logger.debug(`Stored message timestamps for channel ${channelId} from cache to db.`);
  });
};
