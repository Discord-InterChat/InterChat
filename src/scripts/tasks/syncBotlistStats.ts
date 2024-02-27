import { Api } from '@top-gg/sdk';
import Logger from '../../utils/Logger.js';
import { ClusterManager } from 'discord-hybrid-sharding';
import 'dotenv/config';

export const topgg = new Api(process.env.TOPGG_API_KEY as string);

export default async (manager: ClusterManager) => {
  const count = (await manager.fetchClientValues('guilds.cache.size')) as number[];
  const serverCount = count.reduce((p, n) => p + n, 0);
  const { totalShards: shardCount } = manager;

  try {
    await topgg.postStats({ serverCount, shardCount });

    Logger.info(`Updated top.gg stats with ${serverCount} guilds and ${shardCount} shards`);
  }
  catch (e) {
    Logger.error('Error updating top.gg stats', e);
  }
};
