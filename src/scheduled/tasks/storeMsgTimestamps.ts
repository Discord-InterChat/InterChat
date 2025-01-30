import getRedis from '#src/utils/Redis.js';
import { updateConnection } from '#utils/ConnectedListUtils.js';
import { RedisKeys } from '#utils/Constants.js';
import Logger from '#utils/Logger.js';

export default async () => {
  const exists = await getRedis().exists(`${RedisKeys.msgTimestamp}`);
  if (!exists) return;
  const timestampsObj = await getRedis().hgetall(`${RedisKeys.msgTimestamp}`);

  for (const [channelId, timestamp] of Object.entries(timestampsObj)) {
    await updateConnection({ channelId }, { lastActive: new Date(Number.parseInt(timestamp)) });
    Logger.debug(`Stored message timestamps for channel ${channelId} from cache to db.`);
    await getRedis().hdel(`${RedisKeys.msgTimestamp}`, channelId);
  }
};
