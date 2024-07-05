import db from './utils/Db.js';
import Logger from './utils/Logger.js';
import Scheduler from './services/SchedulerService.js';
import syncBotlistStats from './tasks/syncBotlistStats.js';
import updateBlacklists from './tasks/updateBlacklists.js';
import storeMsgTimestamps from './tasks/storeMsgTimestamps.js';
import deleteExpiredInvites from './tasks/deleteExpiredInvites.js';
import pauseIdleConnections from './tasks/pauseIdleConnections.js';
import { startApi } from './api/index.js';
import { isDevBuild } from './utils/Constants.js';
import { getUsername } from './utils/Utils.js';
import { VoteManager } from './managers/VoteManager.js';
import { ClusterManager } from 'discord-hybrid-sharding';
import { getAllConnections } from './utils/ConnectedList.js';
import 'dotenv/config';

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

    const blacklistQuery = { where: { blacklistedFrom: { some: { expires: { isSet: true } } } } };

    // populate cache
    await db.blacklistedServers.findMany(blacklistQuery);
    await db.userData.findMany(blacklistQuery);

    updateBlacklists(clusterManager).catch(Logger.error);
    deleteExpiredInvites().catch(Logger.error);

    if (isDevBuild) return;
    // perform start up tasks
    const serverCount = (await clusterManager.fetchClientValues('guilds.cache.size')).reduce(
      (p: number, n: number) => p + n,
      0,
    );

    syncBotlistStats({ serverCount, shardCount: clusterManager.totalShards }).catch(Logger.error);
    pauseIdleConnections(clusterManager).catch(Logger.error);

    // store network message timestamps to connectedList every minute
    scheduler.addRecurringTask('storeMsgTimestamps', 60 * 1_000, () => storeMsgTimestamps);
    scheduler.addRecurringTask('deleteExpiredInvites', 60 * 60 * 1000, deleteExpiredInvites);
    scheduler.addRecurringTask('populateConnectionCache', 5 * 60 * 1000, () =>
      getAllConnections({ connected: true }),
    );
    scheduler.addRecurringTask('deleteExpiredBlacklists', 10 * 1000, () =>
      updateBlacklists(clusterManager),
    );
    scheduler.addRecurringTask('syncBotlistStats', 10 * 60 * 10_000, () =>
      syncBotlistStats({ serverCount, shardCount: clusterManager.totalShards }),
    );
    scheduler.addRecurringTask('pauseIdleConnections', 60 * 60 * 1000, () =>
      pauseIdleConnections(clusterManager),
    );
  })
  .catch(Logger.error);
