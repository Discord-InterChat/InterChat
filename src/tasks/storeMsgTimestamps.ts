import { modifyConnection } from '../utils/ConnectedList.js';
import db from '../utils/Db.js';
import { serializeCache, getAllDocuments } from '../utils/db/cacheUtils.js';

export default async () => {
  const data = serializeCache<{ channelId: string; lastActive: Date }>(
    await getAllDocuments('msgTimestamp:*'),
  );

  data?.forEach(async ({ lastActive, channelId }) => {
    await modifyConnection({ channelId }, { lastActive });
    await db.cache.del(`msgTimestamp:${channelId}`);
  });
};
