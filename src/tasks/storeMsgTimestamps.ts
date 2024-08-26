import Logger from '#main/utils/Logger.js';
import cacheClient from '#main/utils/cache/cacheClient.js';
import { updateConnection } from '#main/utils/ConnectedList.js';
import { getAllDocuments, serializeCache } from '../utils/cache/cacheUtils.js';
import Constants from '#main/utils/Constants.js';

export default async () => {
  const data = serializeCache<{ channelId: string; timestamp: number }>(
    await getAllDocuments('msgTimestamp:*'),
  );

  data?.forEach(async ({ timestamp, channelId }) => {
    await updateConnection({ channelId }, { lastActive: new Date(timestamp) });
    await cacheClient.del(`${Constants.RedisKeys.msgTimestamp}:${channelId}`);
    Logger.debug(`Stored message timestamps for channel ${channelId} from cache to db.`);
  });
};
