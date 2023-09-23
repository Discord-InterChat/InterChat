import { scheduleJob } from 'node-schedule';
import { modActions } from '../Scripts/networkLogs/modActions';
import { constants, getDb } from './utils';
import { User, EmbedBuilder, Client, TextBasedChannel } from 'discord.js';
import logger from './logger';
import emojis from './JSON/emoji.json';

export async function addUserBlacklist(hubId: string, moderator: User, user: User | string, reason: string, expires?: Date | number, notifyUser = true) {
  if (typeof user === 'string') user = await moderator.client.users.fetch(user);
  if (typeof expires === 'number') expires = new Date(Date.now() + expires);

  const db = getDb();
  const dbUser = await db.blacklistedUsers.create({
    data: {
      hub: { connect: { id: hubId } },
      userId: user.id,
      username: user.username,
      notified: notifyUser,
      expires,
      reason,
    },
  });

  // Send action to logs channel
  modActions(moderator, {
    user,
    action: 'blacklistUser',
    expires,
    reason,
  }).catch(() => null);

  return dbUser;
}

export async function addServerBlacklist(serverId: string, moderator: User, hubId: string, reason: string, expires?: Date) {
  const guild = await moderator.client.guilds.fetch(serverId);
  const db = getDb();

  const dbGuild = await db.blacklistedServers.create({
    data: {
      hub: { connect: { id: hubId } },
      reason: reason,
      serverId: guild.id,
      serverName: guild.name,
      expires: expires,
    },
  });

  // Send action to logs channel
  modActions(moderator, {
    guild: { id: guild.id, resolved: guild },
    action: 'blacklistServer',
    expires: expires,
    reason: reason,
  }).catch(() => null);

  return dbGuild;
}

export function scheduleUnblacklist(type: 'server', client: Client<true>, serverId: string, hubId: string, expires: Date | number): void
export function scheduleUnblacklist(type: 'user', client: Client<true>, userId: string, hubId: string, expires: Date | number): void
export function scheduleUnblacklist(type: string, client: Client<true>, userOrServerId: string, hubId: string, expires: Date | number) {
  if (type === 'server') {
    scheduleJob(`blacklist_server-${userOrServerId}`, expires, async () => {
      const db = getDb();
      const filter = { where: { hubId, serverId: userOrServerId } };
      const dbServer = await db.blacklistedServers.findFirst(filter);

      // only call .delete if the document exists
      // or prisma will error
      if (dbServer) {
        await db.blacklistedServers.deleteMany(filter);
        modActions(client.user, {
          serverId: dbServer.serverId,
          serverName: dbServer.serverName,
          action: 'unblacklistServer',
          timestamp: new Date(),
          reason: 'Blacklist expired for server.',
        }).catch(() => null);
      }
    });
  }

  if (type === 'user') {
    scheduleJob(`blacklist_user-${userOrServerId}`, expires, async () => {
      const db = getDb();
      const filter = { where: { userId: userOrServerId } };
      const dbUser = await db.blacklistedUsers.findFirst(filter);

      const user = await client.users.fetch(userOrServerId).catch(() => null);
      if (!user) return;

      // only call .delete if the document exists
      // or prisma will error
      if (dbUser) {
        await db.blacklistedUsers.delete(filter);
        modActions(client.user, {
          user,
          action: 'unblacklistUser',
          blacklistReason: dbUser.reason,
          reason: 'Blacklist expired for user.',
        }).catch(() => null);
      }
    });
  }
  return false;
}

export async function notifyBlacklist(channel: TextBasedChannel, hubId: string, expires?: Date, reason?: string): Promise<void>
export async function notifyBlacklist(userOrChannel: User | TextBasedChannel, hubId: string, expires?: Date, reason: string = 'No reason provided.') {
  const db = getDb();
  const hub = await db.hubs.findUnique({ where: { id: hubId } });
  const expireString = expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never';

  if (userOrChannel instanceof User) {
    const embed = new EmbedBuilder()
      .setTitle(emojis.normal.blobFastBan + ' Blacklist Notification')
      .setDescription(`You have been blacklisted from talking in hub **${hub?.name}**.`)
      .setColor(constants.colors.interchatBlue)
      .setFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Expires', value: expireString, inline: true },
      );

    userOrChannel.send({ embeds: [embed] }).catch(async () => {
      await db.blacklistedUsers.update({ where: { userId: userOrChannel.id }, data: { notified: false } });
      logger.info(`Could not notify ${(userOrChannel as User).username} about their blacklist.`);
    });
  }
  else if (userOrChannel.isTextBased()) {
    const embed = new EmbedBuilder()
      .setTitle(emojis.normal.blobFastBan + ' Blacklist Notification')
      .setDescription(`This server has been blacklisted from talking in hub **${hub?.name}**.`)
      .setColor(constants.colors.interchatBlue)
      .setFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Expires', value: expireString, inline: true },
      );

    await userOrChannel.send({ embeds: [embed] }).catch(() => null);
  }

}