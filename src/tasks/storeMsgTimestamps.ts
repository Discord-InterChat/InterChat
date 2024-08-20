import Logger from '#main/utils/Logger.js';
import cacheClient from '#main/utils/cache/cacheClient.js';
import { updateConnection } from '#main/utils/ConnectedList.js';
import { getAllDocuments, serializeCache } from '../utils/cache/cacheUtils.js';

export default async () => {
  const data = serializeCache<{ channelId: string; lastActive: string }>(
    await getAllDocuments('msgTimestamp:*'),
  );

  data?.forEach(async ({ lastActive, channelId }) => {
    await updateConnection({ channelId }, { lastActive: new Date(lastActive) });
    await cacheClient.del(`msgTimestamp:${channelId}`);
    Logger.debug(`Stored message timestamps for channel ${channelId} from cache to db.`);
  });
};
