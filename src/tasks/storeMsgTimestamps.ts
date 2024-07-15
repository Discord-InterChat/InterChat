import Logger from '#main/utils/Logger.js';
import { modifyConnection } from '../utils/ConnectedList.js';
import db from '../utils/Db.js';
import { getAllDocuments, serializeCache } from '../utils/db/cacheUtils.js';

export default async () => {
  const data = serializeCache<{ channelId: string; lastActive: string }>(
    await getAllDocuments('msgTimestamp:*'),
  );

  data?.forEach(async ({ lastActive, channelId }) => {
    await modifyConnection({ channelId }, { lastActive });
    await db.cache.del(`msgTimestamp:${channelId}`);
    Logger.debug(`Stored message timestamps for channel ${channelId} from cache to db.`);
  });
};
