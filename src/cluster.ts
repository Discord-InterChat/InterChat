import 'dotenv/config';
import Logger from '#main/utils/Logger.js';
import Scheduler from '#main/modules/SchedulerService.js';
import Constants from '#main/config/Constants.js';
import deleteExpiredInvites from '#main/tasks/deleteExpiredInvites.js';
import pauseIdleConnections from '#main/tasks/pauseIdleConnections.js';
import storeMsgTimestamps from '#main/tasks/storeMsgTimestamps.js';
import syncBotlistStats from '#main/tasks/syncBotlistStats.js';
import { ClusterManager } from 'discord-hybrid-sharding';
import { startApi } from '#main/api/index.js';
import { VoteManager } from '#main/modules/VoteManager.js';
import { getUsername } from '#main/utils/Utils.js';

const clusterManager = new ClusterManager('build/index.js', {
  token: process.env.DISCORD_TOKEN,
  shardsPerClusters: 5,
  totalClusters: 'auto',
});

// spawn clusters and start the api that handles nsfw filter and votes
clusterManager
  .spawn({ timeout: -1 })
  .then(() => {
    const scheduler = new Scheduler();

    deleteExpiredInvites().catch(Logger.error);

    // store network message timestamps to connectedList every minute
    scheduler.addRecurringTask('storeMsgTimestamps', 60 * 1_000, storeMsgTimestamps);
    scheduler.addRecurringTask('deleteExpiredInvites', 60 * 60 * 1000, deleteExpiredInvites);


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

const voteManager = new VoteManager(clusterManager);
voteManager.on('vote', async (vote) => {
  if (vote.type === 'upvote') {
    const username = (await getUsername(clusterManager, vote.user)) ?? undefined;
    await voteManager.incrementUserVote(vote.user, username);
    await voteManager.addVoterRole(vote.user);
  }

  await voteManager.announceVote(vote);
});

startApi(voteManager);
