import { Client } from 'discord.js';
import { scheduleJob } from 'node-schedule';
import { modActions } from '../Scripts/networkLogs/modActions';
import { getDb, topgg } from '../Utils/functions/utils';
import logger from '../Utils/logger';

export default {
  name: 'ready',
  once: true,
  async execute(client: Client) {
    logger.info(`Logged in as ${client.user?.tag}!`);

    // TODO: Don't set interval in main bot
    const db = getDb();
    const messageData = db.messageData;

    // set a property called "expired" to a document that is older than 12 hours.
    setInterval(async () => {
      const older_than_four = new Date(Date.now() - 60 * 60 * 12_000); // 12 hours before now
      await messageData.updateMany({
        where: { timestamp: { lte: older_than_four.getTime() } },
        data: { expired: true },
      });
    }, 60 * 60 * 12_100);

    // Delete all documents that has the property "expired" set to true.
    setInterval(async () => {
      await messageData?.deleteMany({ where: { expired: true } });
    }, 60 * 60 * 24_000);

    if (client.isReady()) {
      const blacklistedServers = await db.blacklistedServers.findMany({ where: { expires: { isSet: true } } });
      const blacklistedUsers = await db.blacklistedUsers.findMany({ where: { expires: { isSet: true } } });

      // timer to unblacklist servers
      blacklistedServers.forEach(async (blacklist) => {
        if (!blacklist.expires) return;
        if (blacklist.expires < new Date()) {
          await db.blacklistedServers.delete({ where: { serverId: blacklist.serverId } });

          modActions(client.user, {
            action: 'unblacklistServer',
            dbGuild: blacklist,
            timestamp: new Date(),
          });
          return;
        }

        scheduleJob(`blacklist_server-${blacklist.serverId}`, blacklist.expires, async function() {
          await db.blacklistedServers.delete({ where: { serverId: blacklist.serverId } });

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
        if (!blacklist.expires) return;

        if (blacklist.expires < new Date()) {
          const user = await client.users.fetch(blacklist.userId).catch(() => null);
          await db.blacklistedUsers.delete({ where: { userId: blacklist.userId } });

          if (!user) return;

          modActions(client.user, {
            action: 'unblacklistUser',
            user,
            timestamp: new Date(),
          });
          return;
        }
        scheduleJob(`blacklist-${blacklist.userId}`, blacklist.expires, async function() {
          const user = await client.users.fetch(blacklist.userId).catch(() => null);
          await db.blacklistedUsers.delete({ where: { userId: blacklist.userId } });

          if (!user) return;
          modActions(user.client.user, {
            action: 'unblacklistUser',
            user,
            reason: 'Blacklist expired.',
            timestamp: new Date(),
          });
        });
      });
    }
    topgg.postStats({ serverCount: client.guilds.cache.size });
  },
};
