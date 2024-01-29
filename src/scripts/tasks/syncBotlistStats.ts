import Logger from '../../utils/Logger.js';
import { updateTopGGStats } from '../../updater/StatsUpdater.js';
import { ClusterManager } from 'discord-hybrid-sharding';

// other jobs
const syncBotlistStats = async (manager: ClusterManager) => {
  const count = (await manager.fetchClientValues('guilds.cache.size')) as number[];
  Logger.info(
    `Updated top.gg stats with ${count.reduce((p, n) => p + n, 0)} guilds and ${
      manager.totalShards
    } shards`,
  );
  // update stats
  await updateTopGGStats(
    count.reduce((p, n) => p + n, 0),
    manager.totalShards,
  );
};

export default syncBotlistStats;