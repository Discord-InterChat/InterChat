import db from './utils/Db.js';
import Logger from './utils/Logger.js';
import Scheduler from './services/SchedulerService.js';
import syncBotlistStats from './scripts/tasks/syncBotlistStats.js';
import updateBlacklists from './scripts/tasks/updateBlacklists.js';
import deleteExpiredInvites from './scripts/tasks/deleteExpiredInvites.js';
import pauseIdleConnections from './scripts/tasks/pauseIdleConnections.js';
import { startApi } from './api/index.js';
import { isDevBuild } from './utils/Constants.js';
import { VoteManager } from './managers/VoteManager.js';
import { ClusterManager } from 'discord-hybrid-sharding';
import { getUsername, wait } from './utils/Utils.js';
import 'dotenv/config';

const clusterManager = new ClusterManager('build/index.js', {
  token: process.env.TOKEN,
  shardsPerClusters: 2,
  totalClusters: 'auto',
});

clusterManager.on('clusterCreate', async (cluster) => {
  // if it is the last cluster
  if (cluster.id === clusterManager.totalClusters - 1) {
    const scheduler = new Scheduler();

    // remove expired blacklists or set new timers for them
    const serverQuery = await db.blacklistedServers.findMany({
      where: { hubs: { some: { expires: { isSet: true } } } },
    });
    const userQuery = await db.userData.findMany({
      where: { blacklistedFrom: { some: { expires: { isSet: true } } } },
    });

    updateBlacklists(serverQuery, scheduler).catch(Logger.error);
    updateBlacklists(userQuery, scheduler).catch(Logger.error);

    // code must be in production to run these tasks
    if (isDevBuild) return;
    // give time for shards to connect for these tasks
    await wait(10_000);

    // perform start up tasks
    syncBotlistStats(clusterManager).catch(Logger.error);
    deleteExpiredInvites().catch(Logger.error);
    pauseIdleConnections(clusterManager).catch(Logger.error);

    scheduler.addRecurringTask('deleteExpiredInvites', 60 * 60 * 1000, deleteExpiredInvites);
    scheduler.addRecurringTask('pauseIdleConnections', 60 * 60 * 1000, () =>
      pauseIdleConnections(clusterManager),
    );
    scheduler.addRecurringTask('syncBotlistStats', 10 * 60 * 10_000, () =>
      syncBotlistStats(clusterManager),
    );
  }
});

const voteManager = new VoteManager(clusterManager);
voteManager.on('vote', async (vote) => {
  const username = (await getUsername(clusterManager, vote.user)) ?? undefined;
  await voteManager.incrementUserVote(vote.user, username);
  await voteManager.addVoterRole(vote.user);
  await voteManager.announceVote(vote);
});

// spawn clusters and start the api that handles nsfw filter and votes
clusterManager
  .spawn({ timeout: -1 })
  .then(() => startApi({ voteManager }))
  .catch(Logger.error);
