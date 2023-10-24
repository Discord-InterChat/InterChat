import db from '../utils/Db.js';
import Scheduler from '../services/SchedulerService.js';
import SuperClient from '../SuperClient.js';
import { blacklistedServers, blacklistedUsers } from '@prisma/client';
import { EmbedBuilder, Snowflake } from 'discord.js';
import { emojis, colors } from '../utils/Constants.js';
import { captureException } from '@sentry/node';
import Logger from '../utils/Logger.js';

export default class BlacklistManager {
  private scheduler: Scheduler;

  constructor(scheduler: Scheduler) {
    this.scheduler = scheduler;
  }

  /**
   * Remove a user or server from the blacklist.
   * @param type The type of blacklist to remove.
   * @param hubId The hub ID to remove the blacklist from.
   * @param userOrServerId The user or server ID to remove from the blacklist.
   * @returns The updated blacklist.
   */
  async removeBlacklist(
    type: 'server',
    hubId: string,
    serverId: string,
  ): Promise<blacklistedServers>;
  async removeBlacklist(type: 'user', hubId: string, userId: string): Promise<blacklistedUsers>;
  async removeBlacklist(type: 'user' | 'server', hubId: string, userOrServerId: string) {
    this.scheduler.stopTask(`blacklist_${type}-${userOrServerId}`);
    const data = {
      hubs: { deleteMany: { where: { hubId } } },
    };

    if (type === 'user') {
      const where = { userId: userOrServerId, hubs: { some: { hubId } } };

      const notInBlacklist = await db.blacklistedUsers.findFirst({ where });
      if (!notInBlacklist) return;

      return await db.blacklistedUsers.update({ where, data });
    }
    else {
      const where = { serverId: userOrServerId, hubs: { some: { hubId } } };

      const notInBlacklist = await db.blacklistedServers.findFirst({ where });
      if (!notInBlacklist) return;

      return await db.blacklistedServers.update({ where, data });
    }
  }

  /**
   * Schedule the removal of a user or server from the blacklist.
   * @param type The type of blacklist to remove. (user/server)
   * @param userOrServerId The user or server ID to remove from the blacklist.
   * @param hubId The hub ID to remove the blacklist from.
   * @param expires The date or milliseconds to wait before removing the blacklist.
   */
  async scheduleRemoval(
    type: 'server' | 'user',
    userOrServerId: string,
    hubId: string,
    expires: Date | number,
  ): Promise<void> {
    let name: string;
    let execute;

    if (type === 'server') {
      if (this.scheduler.taskNames.includes(`unblacklistServer-${userOrServerId}`)) {
        this.scheduler.stopTask(`unblacklistServer-${userOrServerId}`);
      }

      name = `unblacklistServer-${userOrServerId}`;
      execute = () => this.removeBlacklist('server', hubId, userOrServerId);
    }
    else {
      if (this.scheduler.taskNames.includes(`unblacklistUser-${userOrServerId}`)) {
        this.scheduler.stopTask(`unblacklistUser-${userOrServerId}`);
      }

      name = `unblacklistUser-${userOrServerId}`;
      execute = () => this.removeBlacklist('user', hubId, userOrServerId);
    }

    this.scheduler.addTask(name, expires, execute);
  }

  /**
   * Notify a user or server that they have been blacklisted.
   * @param type The type of blacklist to notify. (user/server)
   * @param userOrServerId The user or server ID to notify.
   * @param hubId The hub ID to notify.
   * @param expires The date after which the blacklist expires.
   * @param reason The reason for the blacklist.
   */
  async notifyBlacklist(
    type: 'user' | 'server',
    userOrServerId: string,
    hubId: string,
    expires?: Date,
    reason: string = 'No reason provided.',
  ): Promise<void> {
    const hub = await db.hubs.findUnique({ where: { id: hubId } });
    const expireString = expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never';
    const embed = new EmbedBuilder()
      .setTitle(emojis.blobFastBan + ' Blacklist Notification')
      .setColor(colors.interchatBlue)
      .setFields(
        { name: 'Reason', value: reason, inline: true },
        { name: 'Expires', value: expireString, inline: true },
      );

    if (type === 'user') {
      embed.setDescription(`You have been blacklisted from talking in hub **${hub?.name}**.`);
      const user = await SuperClient.getInstance().users.fetch(userOrServerId);
      try {
        await user.send({ embeds: [embed] });
      }
      catch (e) {
        Logger.error(e);
        captureException(e);
      }
    }
    else {
      embed.setDescription(
        `This server has been blacklisted from talking in hub **${hub?.name}**.`,
      );
      const serverConnected = await db.connectedList.findFirst({
        where: { serverId: userOrServerId, hubId },
      });

      if (!serverConnected) return;

      await SuperClient.getInstance().cluster.broadcastEval(
        async (client, ctx) => {
          const channel = await client.channels.fetch(ctx.channelId).catch(() => null);
          if (!channel?.isTextBased()) return;

          await channel.send({ embeds: [ctx.embed] }).catch(() => null);
        },
        { context: { channelId: serverConnected.channelId, embed: embed.toJSON() } },
      );
    }
  }

  /**
   * Fetch a user blacklist from the database.
   * @param hubId The hub ID to fetch the blacklist from.
   * @param userId The ID of the blacklisted user.
   */
  static async fetchUserBlacklist(hubId: string, userId: string) {
    const userBlacklisted = await db.blacklistedUsers.findFirst({
      where: { userId, hubs: { some: { hubId } } },
    });
    return userBlacklisted;
  }

  /**
   * Fetch a server blacklist from the database.
   * @param hubId The hub ID to fetch the blacklist from.
   * @param serverId The ID of the blacklisted serverId.
   */
  static async fetchServerBlacklist(hubId: string, serverId: string) {
    const userBlacklisted = await db.blacklistedServers.findFirst({
      where: { serverId, hubs: { some: { hubId } } },
    });
    return userBlacklisted;
  }

  /**
   * Add a user to the blacklist.
   * @param hubId The ID of the hub to add the blacklist to.
   * @param userId The ID of the user to blacklist.
   * @param reason The reason for the blacklist.
   * @param expires The date or milliseconds after which the blacklist will expire.
   * @returns The created blacklist.
   */
  async addUserBlacklist(
    hubId: string,
    userId: Snowflake,
    reason: string,
    moderatorId: Snowflake,
    expires?: Date | number,
  ) {
    const client = SuperClient.getInstance();
    const user = await client.users.fetch(userId);
    if (typeof expires === 'number') expires = new Date(Date.now() + expires);

    const dbUser = await db.blacklistedUsers.findFirst({ where: { userId: user.id } });

    const hubs = dbUser?.hubs.filter((i) => i.hubId !== hubId) || [];
    hubs?.push({ expires: expires ?? null, reason, hubId, moderatorId });

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

  /**
   * Add a server to the blacklist.
   * @param serverId The ID of the server to blacklist.
   * @param hubId The ID of the hub to add the blacklist to.
   * @param reason The reason for the blacklist.
   * @param expires The date after which the blacklist will expire.
   * @returns The created blacklist.
   */
  async addServerBlacklist(
    serverId: Snowflake,
    hubId: string,
    reason: string,
    moderatorId: Snowflake,
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
        hubs: { push: { hubId, expires, reason, moderatorId } },
      },
      create: {
        serverId: guild.id,
        serverName: guild.name,
        hubs: [{ hubId, expires, reason, moderatorId }],
      },
    });

    return dbGuild;
  }
}
