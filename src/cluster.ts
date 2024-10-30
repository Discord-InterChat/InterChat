import { startApi } from '#main/api/index.js';
import Constants from '#main/config/Constants.js';
import Scheduler from '#main/modules/SchedulerService.js';
import deleteExpiredInvites from '#main/tasks/deleteExpiredInvites.js';
import pauseIdleConnections from '#main/tasks/pauseIdleConnections.js';
import storeMsgTimestamps from '#main/tasks/storeMsgTimestamps.js';
import syncBotlistStats from '#main/tasks/syncBotlistStats.js';
import Logger from '#utils/Logger.js';
import { ClusterManager, HeartbeatManager, ReClusterManager } from 'discord-hybrid-sharding';
import 'dotenv/config';

const shardsPerClusters = 5;
const clusterManager = new ClusterManager('build/index.js', {
  token: process.env.DISCORD_TOKEN,
  totalShards: 'auto',
  totalClusters: 'auto',
  shardsPerClusters,
});

clusterManager.extend(new HeartbeatManager({ interval: 10 * 1000, maxMissedHeartbeats: 2 }));
clusterManager.extend(new ReClusterManager());

clusterManager.on('clusterReady', (cluster) => {
  Logger.info(
    `Cluster ${cluster.id} is ready with shards ${cluster.shardList[0]}...${cluster.shardList.at(-1)}.`,
  );

  if (cluster.id === clusterManager.totalClusters - 1) startTasks();

  cluster.on('message', async (message) => {
    if (message === 'recluster') {
      Logger.info('Recluster requested, starting recluster...');
      const recluster = await clusterManager.recluster?.start({
        restartMode: 'rolling',
        totalShards: 'auto',
        shardsPerClusters,
      });

      if (recluster?.success) Logger.info('Recluster completed successfully.');
      else Logger.error('Failed to recluster!');
    }
  });
});

// spawn clusters and start the api that handles nsfw filter and votes
clusterManager.spawn({ timeout: -1 });

function startTasks() {
  startApi();

  pauseIdleConnections(clusterManager).catch(Logger.error);
  deleteExpiredInvites().catch(Logger.error);

  const scheduler = new Scheduler();

  // store network message timestamps to connectedList every minute
  scheduler.addRecurringTask('storeMsgTimestamps', 10 * 60 * 1000, storeMsgTimestamps);
  scheduler.addRecurringTask('cleanupTasks', 60 * 60 * 1000, () => {
    deleteExpiredInvites().catch(Logger.error);
    pauseIdleConnections(clusterManager).catch(Logger.error);
  });

  // production only tasks
  if (!Constants.isDevBuild) {
    scheduler.addRecurringTask('syncBotlistStats', 10 * 60 * 10_000, async () => {
      const servers = await clusterManager.fetchClientValues('guilds.cache.size');
      const serverCount = servers.reduce((p: number, n: number) => p + n, 0);
      syncBotlistStats({ serverCount, shardCount: clusterManager.totalShards });
    });
  }
}
