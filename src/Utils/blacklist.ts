import { cancelJob, scheduleJob } from 'node-schedule';
import { modActions } from '../Scripts/networkLogs/modActions';
import { constants, getDb } from './utils';
import { User, EmbedBuilder, Client, TextBasedChannel } from 'discord.js';
import emojis from './JSON/emoji.json';
import { blacklistedServers, blacklistedUsers } from '@prisma/client';


export async function findBlacklistedUser(hubId: string, userId: string) {
  const db = getDb();
  const userBlacklisted = await db.blacklistedUsers.findFirst({
    where: { userId, hubs: { some: { hubId } } },
  });
  return userBlacklisted;
}

export async function findBlacklistedServer(hubId: string, serverId: string) {
  const db = getDb();
  const userBlacklisted = await db.blacklistedServers.findFirst({
    where: { serverId, hubs: { some: { hubId } } },
  });
  return userBlacklisted;
}

export async function addUserBlacklist(hubId: string, moderator: User, user: User | string, reason: string, expires?: Date | number) {
  if (typeof user === 'string') user = await moderator.client.users.fetch(user);
  if (typeof expires === 'number') expires = new Date(Date.now() + expires);

  const db = getDb();
  const dbUser = await db.blacklistedUsers.findFirst({ where: { userId: user.id } });

  const hubs = dbUser?.hubs.filter((i) => i.hubId !== hubId) || [];
  hubs?.push({ expires: expires || null, reason, hubId });

  const updatedUser = await db.blacklistedUsers.upsert({
    where: {
      userId: user.id,
    },
    update: {
      username: user.username,
      hubs: { set: hubs },
    },
    create: {
      userId: user.id,
      username: user.username,
      hubs,
    },
  });

  // Send action to logs channel
  modActions(moderator, {
    user,
    action: 'blacklistUser',
    expires,
    reason,
  }).catch(() => null);

  return updatedUser;
}

export async function addServerBlacklist(serverId: string, moderator: User, hubId: string, reason: string, expires?: Date) {
  const guild = await moderator.client.guilds.fetch(serverId);
  const db = getDb();

  const dbGuild = await db.blacklistedServers.upsert({
    where: {
      serverId: guild.id,
    },
    update: {
      serverName: guild.name,
      hubs: { push: { hubId, expires, reason } },
    },
    create: {
      serverId: guild.id,
      serverName: guild.name,
      hubs: [{ hubId, expires, reason }],
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

export async function removeBlacklist(type: 'user', hubId: string, userId: string): Promise<blacklistedUsers>
export async function removeBlacklist(type: 'server', hubId: string, serverId: string): Promise<blacklistedServers>
export async function removeBlacklist(type: string, hubId: string, userOrServerId: string) {
  const db = getDb();
  cancelJob(`blacklist_${type}-${userOrServerId}`);


  if (type === 'user') {
    return await db.blacklistedUsers.update({
      where: {
        userId: userOrServerId,
        hubs: { some: { hubId } },
      },
      data: {
        hubs: { deleteMany: { where: { hubId } } },
      },
    });
  }
  else {
    return db.blacklistedServers.update({
      where: {
        serverId: userOrServerId,
        hubs: { some: { hubId } },
      },
      data: {
        hubs: { deleteMany: { where: { hubId } } },
      },
    });
  }
}


export function scheduleUnblacklist(type: 'user' | 'server', client: Client<true>, userOrServerId: string, hubId: string, expires: Date | number) {
  if (type === 'server') {
    return scheduleJob(`blacklist_server-${userOrServerId}`, expires, async function() {
      const db = getDb();
      const dbServer = await db.blacklistedServers.findFirst({
        where: { serverId: userOrServerId, hubs: { some: { hubId } } },
      });

      // only call .delete if the document exists
      // or prisma will error
      if (dbServer) {
        await removeBlacklist('server', hubId, userOrServerId);

        modActions(client.user, {
          action: 'unblacklistServer',
          oldBlacklist: dbServer,
          timestamp: new Date(),
          hubId,
        }).catch(() => null);
      }
    });
  }

  if (type === 'user') {
    return scheduleJob(`blacklist_user-${userOrServerId}`, expires, async () => {
      const db = getDb();
      const dbUser = await db.blacklistedUsers.findFirst({
        where: { userId: userOrServerId, hubs: { some: { hubId } } },
      });

      const user = await client.users.fetch(userOrServerId).catch(() => null);
      if (!user || !dbUser) return;

      await removeBlacklist('user', hubId, userOrServerId);

      modActions(client.user, {
        user,
        hubId,
        action: 'unblacklistUser',
        blacklistedFor: dbUser.hubs.find(h => h.hubId === hubId)?.reason,
      }).catch(() => null);
    });
  }
}

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

    userOrChannel.send({ embeds: [embed] }).catch(async () => null);
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