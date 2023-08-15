import { Client } from 'discord.js';
import { scheduleJob } from 'node-schedule';
import { modActions } from '../../Scripts/networkLogs/modActions';
import { getDb } from './utils';

/** A function to start timers for blacklist expiry, messageData cleanup, etc. */
export default async function startTimers(client: Client) {
  const db = getDb();

  // Delete all documents that are older than 24 hours old.
  scheduleJob('messageExpired', { hour: 24, second: 5 }, async () => {
    const olderThan = new Date(Date.now() - 60 * 60 * 24_000);
    await db.messageData.deleteMany({ where: { timestamp: { lte: olderThan } } });
  });

  scheduleJob('inviteExpired', { hour: 1 }, async () => {
    const olderThan = new Date(Date.now() - 60 * 60 * 1_000);
    await db.hubInvites.deleteMany({ where: { expires: { lte: olderThan } } });
  });

  // Timers that start only if the bot is logged in.
  const blacklistedServers = await db.blacklistedServers.findMany({ where: { expires: { isSet: true } } });
  const blacklistedUsers = await db.blacklistedUsers.findMany({ where: { expires: { isSet: true } } });

  // timer to unblacklist servers
  blacklistedServers.forEach(async (blacklist) => {
    if (!blacklist.expires || !client.user) return;

    if (blacklist.expires < new Date()) {
      await db.blacklistedServers.delete({ where: { id: blacklist.id } });

      modActions(client.user, {
        action: 'unblacklistServer',
        dbGuild: blacklist,
        timestamp: new Date(),
      });
      return;
    }

    scheduleJob(`blacklist_server-${blacklist.serverId}`, blacklist.expires, async function() {
      if (!client.user) return;
      await db.blacklistedServers.delete({ where: { id: blacklist.id } });

      modActions(client.user, {
        action: 'unblacklistServer',
        dbGuild: blacklist,
        reason: 'Blacklist expired.',
        timestamp: new Date(),
      });
    });
  });

  // timer to unblacklist users
  blacklistedUsers.forEach(async (blacklist) => {
    if (!blacklist.expires || !client.user) return;

    // if the blacklist has already expired, delete it from the database
    if (blacklist.expires < new Date()) {
      await db.blacklistedUsers.delete({ where: { userId: blacklist.userId } });
      const user = await client.users.fetch(blacklist.userId).catch(() => null);

      if (!user) return;

      modActions(client.user, { action: 'unblacklistUser', user, reason: 'Blacklist expired.', blacklistReason: blacklist.reason });
      return;
    }

    // if the blacklist has not expired, schedule a new job to unblacklist the user
    scheduleJob(`blacklist-${blacklist.userId}`, blacklist.expires, async function(job_blacklist: typeof blacklist) {
      const user = await client.users.fetch(job_blacklist.userId).catch(() => null);
      await db.blacklistedUsers.delete({ where: { userId: job_blacklist.userId } });

      if (!user) return;
      modActions(user.client.user, {
        action: 'unblacklistUser',
        reason: 'Blacklist expired.',
        blacklistReason: job_blacklist.reason,
        user,
      });
    }.bind(null, blacklist));
  });
}