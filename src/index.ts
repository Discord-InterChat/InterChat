import db from './utils/Db.js';
import Logger from './utils/Logger.js';
import Scheduler from './services/SchedulerService.js';
import BlacklistManager from './managers/BlacklistManager.js';
import { ClusterManager } from 'discord-hybrid-sharding';
import { updateTopGGStats } from './updater/StatsUpdater.js';
import { isDevBuild } from './utils/Constants.js';
import { blacklistedServers, userData } from '@prisma/client';
import { wait } from './utils/Utils.js';
import 'dotenv/config';

const manager = new ClusterManager('build/InterChat.js', {
  totalShards: 'auto',
  mode: 'process',
  token: process.env.TOKEN,
  shardsPerClusters: 2,
});

manager.spawn({ timeout: -1 });

// other jobs
const syncBotlistStats = async () => {
  const count = (await manager.fetchClientValues('guilds.cache.size')) as number[];
  Logger.info(
    `Updated top.gg stats with ${count.reduce((p, n) => p + n, 0)} guilds and ${
      manager.totalShards
    } shards`,
  );
  // update stats
  updateTopGGStats(
    count.reduce((p, n) => p + n, 0),
    manager.totalShards,
  );
};

const deleteExpiredInvites = async () => {
  const olderThan1h = new Date(Date.now() - 60 * 60 * 1_000);
  await db.hubInvites.deleteMany({ where: { expires: { lte: olderThan1h } } }).catch(() => null);
};

const deleteOldMessages = async () => {
  // Delete all documents that are older than 24 hours old.
  const olderThan24h = new Date(Date.now() - 60 * 60 * 24_000);
  await db.messageData
    .deleteMany({ where: { timestamp: { lte: olderThan24h } } })
    .catch(() => null);
};

const processAndManageBlacklists = async (
  blacklists: (blacklistedServers | userData)[],
  scheduler: Scheduler,
) => {
  if (blacklists.length === 0) return;

  const blacklistManager = new BlacklistManager(scheduler);
  for (const blacklist of blacklists) {
    const blacklistedFrom = 'hubs' in blacklist ? blacklist.hubs : blacklist.blacklistedFrom;
    for (const { hubId, expires } of blacklistedFrom) {
      if (!expires) continue;

      if (expires < new Date()) {
        if ('serverId' in blacklist) {
          blacklistManager.removeBlacklist('server', hubId, blacklist.serverId);
        }
        else {
          await blacklistManager.removeBlacklist('user', hubId, blacklist.userId);
        }
        continue;
      }

      blacklistManager.scheduleRemoval(
        'serverId' in blacklist ? 'server' : 'user',
        'serverId' in blacklist ? blacklist.serverId : blacklist.userId,
        hubId,
        expires,
      );
    }
  }
};

manager.on('clusterCreate', async (cluster) => {
  // if it is the last cluster
  if (cluster.id === manager.totalClusters - 1) {
    const scheduler = new Scheduler();
    // remove expired blacklists or set new timers for them
    const serverQuery = { where: { hubs: { some: { expires: { isSet: true } } } } };
    const userQuery = { where: { blacklistedFrom: { some: { expires: { isSet: true } } } } };
    processAndManageBlacklists(await db.blacklistedServers.findMany(serverQuery), scheduler);
    processAndManageBlacklists(await db.userData.findMany(userQuery), scheduler);

    // code must be in production to run these tasks
    if (isDevBuild) return;
    // give time for shards to connect for these tasks
    await wait(10_000);

    // perform start up tasks
    syncBotlistStats();
    deleteOldMessages();
    deleteExpiredInvites();

    // update top.gg stats every 10 minutes
    scheduler.addRecurringTask('syncBotlistStats', 60 * 10_000, syncBotlistStats);
    // delete expired invites every 1 hour
    scheduler.addRecurringTask('deleteExpiredInvites', 60 * 60 * 1_000, deleteExpiredInvites);
    // delete old network messages every 12 hours
    scheduler.addRecurringTask('deleteOldMessages', 60 * 60 * 12_000, deleteOldMessages);
  }
});
