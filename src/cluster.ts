import 'dotenv/config';
import { ClusterManager } from 'discord-hybrid-sharding';
import { startApi } from './api/index.js';
import { VoteManager } from './modules/VoteManager.js';
import Logger from './utils/Logger.js';
import Scheduler from './modules/SchedulerService.js';
import deleteExpiredInvites from './tasks/deleteExpiredInvites.js';
import pauseIdleConnections from './tasks/pauseIdleConnections.js';
import storeMsgTimestamps from './tasks/storeMsgTimestamps.js';
import syncBotlistStats from './tasks/syncBotlistStats.js';
import updateBlacklists from './tasks/updateBlacklists.js';
import { getUsername } from './utils/Utils.js';
import Constants from '#main/utils/Constants.js';

const clusterManager = new ClusterManager('build/index.js', {
  token: process.env.TOKEN,
  shardsPerClusters: 5,
  totalClusters: 'auto',
});

const voteManager = new VoteManager(clusterManager);
voteManager.on('vote', async (vote) => {
  const username = (await getUsername(clusterManager, vote.user)) ?? undefined;
  await voteManager.incrementUserVote(vote.user, username);
  await voteManager.addVoterRole(vote.user);
  await voteManager.announceVote(vote);
});

startApi({ voteManager });

// spawn clusters and start the api that handles nsfw filter and votes
clusterManager
  .spawn({ timeout: -1 })
  .then(async () => {
    const scheduler = new Scheduler();

    updateBlacklists(clusterManager).catch(Logger.error);
    deleteExpiredInvites().catch(Logger.error);

    // store network message timestamps to connectedList every minute
    scheduler.addRecurringTask('storeMsgTimestamps', 60 * 1_000, storeMsgTimestamps);
    scheduler.addRecurringTask('deleteExpiredInvites', 60 * 60 * 1000, deleteExpiredInvites);
    scheduler.addRecurringTask('deleteExpiredBlacklists', 30 * 1000, () =>
      updateBlacklists(clusterManager),
    );

    // production only tasks
    if (Constants.isDevBuild) return;

    pauseIdleConnections(clusterManager).catch(Logger.error);

    scheduler.addRecurringTask('syncBotlistStats', 10 * 60 * 10_000, async () => {
      // perform start up tasks
      const serverCount = (await clusterManager.fetchClientValues('guilds.cache.size')).reduce(
        (p: number, n: number) => p + n,
        0,
      );
      syncBotlistStats({ serverCount, shardCount: clusterManager.totalShards });
    });
    scheduler.addRecurringTask('pauseIdleConnections', 60 * 60 * 1000, () =>
      pauseIdleConnections(clusterManager),
    );
  })
  .catch(Logger.error);
