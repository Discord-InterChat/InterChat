import db from './utils/Db.js';
import Logger from './utils/Logger.js';
import { ClusterManager } from 'discord-hybrid-sharding';
import { updateTopGGStats } from './updater/StatsUpdater.js';
import { isDevBuild } from './utils/Constants.js';
import { Scheduler } from './structures/Scheduler.js';
import { blacklistedServers, blacklistedUsers } from '@prisma/client';
import { BlacklistManager } from './structures/BlacklistManager.js';
import { wait } from './utils/Utils.js';
import 'dotenv/config';

const manager = new ClusterManager('build/InterChat.js', {
  totalShards: 1,
  mode: 'process',
  token: process.env.TOKEN,
  shardsPerClusters: 1,
  shardArgs: [`--production=${isDevBuild}`],
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

const loopThruBlacklists = (blacklists: (blacklistedServers | blacklistedUsers)[], scheduler: Scheduler) => {
  if (blacklists.length === 0) return;

  const blacklistManager = new BlacklistManager(scheduler);
  for (const blacklist of blacklists) {
    for (const { hubId, expires } of blacklist.hubs) {
      if (!expires) continue;

      if (expires < new Date()) {
        if ('serverId' in blacklist) blacklistManager.removeBlacklist('server', hubId, blacklist.serverId);
        else blacklistManager.removeBlacklist('user', hubId, blacklist.userId);
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
  // last cluster
  if (cluster.id === manager.totalClusters - 1 && !isDevBuild) {
    // give time for shards to connect
    await wait(10_000);

    // perform tasks on start up
    syncBotlistStats();
    deleteOldMessages();
    deleteExpiredInvites();

    const scheduler = new Scheduler();

    // update top.gg stats every 10 minutes
    scheduler.addTask('syncBotlistStats', 60 * 10_000, syncBotlistStats); // every 10 minutes
    scheduler.addTask('deleteExpiredInvites', 60 * 60 * 1_000, deleteExpiredInvites); // every hour
    scheduler.addTask('deleteOldMessages', 60 * 60 * 12_000, deleteOldMessages); // every 12 hours

    // remove expired blacklists or set new timers for them
    const query = { where: { hubs: { some: { expires: { isSet: true } } } } };
    loopThruBlacklists(await db.blacklistedServers.findMany(query), scheduler);
    loopThruBlacklists(await db.blacklistedUsers.findMany(query), scheduler);
  }
});
