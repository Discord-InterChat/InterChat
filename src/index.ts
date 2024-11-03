import startTasks from '#main/scheduled/startTasks.js';
import Logger from '#utils/Logger.js';
import { ClusterManager, HeartbeatManager, ReClusterManager } from 'discord-hybrid-sharding';
import 'dotenv/config';

const shardsPerClusters = 6;
const clusterManager = new ClusterManager('build/client.js', {
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

  if (cluster.id === clusterManager.totalClusters - 1) startTasks(clusterManager);

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
