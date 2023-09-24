import { Client } from 'discord.js';
import { scheduleJob } from 'node-schedule';
import { modActions } from '../Scripts/networkLogs/modActions';
import { getDb } from './utils';
import { removeBlacklist } from './blacklist';

/** A function to start timers for blacklist expiry, messageData cleanup, etc. */
export default async function startTimers(client: Client<true>) {
  const db = getDb();

  // Delete all documents that are older than 24 hours old.
  scheduleJob('invite/messageExpired', { hour: 1 }, async () => {
    const olderThan1h = new Date(Date.now() - 60 * 60 * 1_000);
    await db.hubInvites
      .deleteMany({ where: { expires: { lte: olderThan1h } } })
      .catch(() => null);

    const olderThan24h = new Date(Date.now() - 60 * 60 * 24_000);
    await db.messageData
      .deleteMany({ where: { timestamp: { lte: olderThan24h } } })
      .catch(() => null);
  });

  const query = { where: { hubs: { some: { expires: { isSet: true } } } } };
  const blacklistedServers = await db.blacklistedServers.findMany(query);
  const blacklistedUsers = await db.blacklistedUsers.findMany(query);

  // timer to unblacklist servers
  blacklistedServers.forEach(async (blacklist) => {
    blacklist.hubs.forEach(({ hubId, expires }) => {
      if (!expires) return;

      removeBlacklist('server', hubId, blacklist.serverId);

      if (expires < new Date()) {

        modActions(client.user, {
          action: 'unblacklistServer',
          oldBlacklist: blacklist,
          timestamp: new Date(),
          hubId,
        });
        return;
      }

      scheduleJob(`blacklist_server-${blacklist.serverId}`, expires, async function() {
        await db.blacklistedServers.delete({ where: { id: blacklist.id } });

        modActions(client.user, {
          action: 'unblacklistServer',
          oldBlacklist: blacklist,
          timestamp: new Date(),
          hubId,
        });
      });

    });
  });

  // timer to unblacklist users
  blacklistedUsers.forEach(async (blacklist) => {
    blacklist.hubs.forEach(async ({ hubId, expires, reason }) => {
      if (!expires) return;

      // if the blacklist has already expired, delete it from the database
      if (expires < new Date()) {
        await removeBlacklist('user', hubId, blacklist.userId);
        const user = await client.users.fetch(blacklist.userId).catch(() => null);

        if (!user) return;

        modActions(client.user, { action: 'unblacklistUser', user, hubId, blacklistedFor: reason });
        return;
      }

      // if the blacklist has not expired, schedule a new job to unblacklist the user
      scheduleJob(`blacklist-${blacklist.userId}`, expires, async function(job_blacklist: typeof blacklist) {
        const user = await client.users.fetch(job_blacklist.userId).catch(() => null);
        await db.blacklistedUsers.delete({ where: { userId: job_blacklist.userId } });

        if (!user) return;

        modActions(user.client.user, {
          action: 'unblacklistUser',
          blacklistedFor: reason,
          user,
          hubId,
        });
      }.bind(null, blacklist));
    });
  });
}