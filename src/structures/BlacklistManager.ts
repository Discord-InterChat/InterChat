import db from '../utils/Db.js';
import Logger from '../utils/Logger.js';
import Scheduler from './Scheduler.js';
import SuperClient from '../SuperClient.js';
import { blacklistedServers, blacklistedUsers } from '@prisma/client';
import { User, TextBasedChannel, EmbedBuilder } from 'discord.js';
import { emojis, colors } from '../utils/Constants.js';
import { captureException } from '@sentry/node';

export default class BlacklistManager {
  private scheduler: Scheduler;

  constructor(scheduler: Scheduler) {
    this.scheduler = scheduler;
  }

  async removeBlacklist(
    type: 'server',
    hubId: string,
    serverId: string,
  ): Promise<blacklistedServers>;
  async removeBlacklist(
    type: 'user',
    hubId: string,
    userId: string,
  ): Promise<blacklistedUsers>;
  async removeBlacklist(
    type: 'user' | 'server',
    hubId: string,
    userOrServerId: string,
  ) {
    // FIXME find a better way to pass scheduler
    this.scheduler.stopTask(`blacklist_${type}-${userOrServerId}`);

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

  async scheduleRemoval(
    type: 'server' | 'user',
    userOrServerId: string,
    hubId: string,
    expires: Date | number,
  ) {
    let name: string;
    let execute;

    if (type === 'server') {
      name = `unblacklistServer-${userOrServerId}`;
      execute = () => this.removeBlacklist('server', hubId, userOrServerId);
    }
    else {
      name = `unblacklistUser-${userOrServerId}`;
      execute = () => this.removeBlacklist('user', hubId, userOrServerId);
    }

    this.scheduler.addTask(name, expires, execute);
  }

  async notifyBlacklist(
    userOrChannel: User | TextBasedChannel,
    hubId: string,
    expires?: Date,
    reason: string = 'No reason provided.',
  ) {
    const hub = await db.hubs.findUnique({ where: { id: hubId } });
    const expireString = expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never';
    let embed: EmbedBuilder;

    if (userOrChannel instanceof User) {
      embed = new EmbedBuilder()
        .setTitle(emojis.blobFastBan + ' Blacklist Notification')
        .setDescription(`You have been blacklisted from talking in hub **${hub?.name}**.`)
        .setColor(colors.interchatBlue)
        .setFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Expires', value: expireString, inline: true },
        );
    }
    else {
      embed = new EmbedBuilder()
        .setTitle(emojis.blobFastBan + ' Blacklist Notification')
        .setDescription(`This server has been blacklisted from talking in hub **${hub?.name}**.`)
        .setColor(colors.interchatBlue)
        .setFields(
          { name: 'Reason', value: reason, inline: true },
          { name: 'Expires', value: expireString, inline: true },
        );
    }

    try {
      await userOrChannel.send({ embeds: [embed] }).catch(() => null);
    }
    catch (e) {
      Logger.error(e);
      captureException(e);
    }
  }


  static async fetchUserBlacklist(hubId: string, userId: string) {
    const userBlacklisted = await db.blacklistedUsers.findFirst({
      where: { userId, hubs: { some: { hubId } } },
    });
    return userBlacklisted;
  }


  static async fetchServerBlacklist(hubId: string, serverId: string) {
    const userBlacklisted = await db.blacklistedServers.findFirst({
      where: { serverId, hubs: { some: { hubId } } },
    });
    return userBlacklisted;
  }


  async addUserBlacklist(
    hubId: string,
    userId: string,
    reason: string,
    expires?: Date | number,
  ) {
    const client = SuperClient.getInstance();
    const user = await client.users.fetch(userId);
    if (typeof expires === 'number') expires = new Date(Date.now() + expires);

    const dbUser = await db.blacklistedUsers.findFirst({ where: { userId: user.id } });

    const hubs = dbUser?.hubs.filter((i) => i.hubId !== hubId) || [];
    hubs?.push({ expires: expires ?? null, reason, hubId });

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

    return updatedUser;
  }


  async addServerBlacklist(
    serverId: string,
    hubId: string,
    reason: string,
    expires?: Date,
  ) {
    const client = SuperClient.getInstance();
    const guild = await client.fetchGuild(serverId);
    if (!guild) return;

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

    return dbGuild;
  }
}

