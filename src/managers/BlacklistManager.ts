import db from '../utils/Db.js';
import Scheduler from '../services/SchedulerService.js';
import SuperClient from '../core/Client.js';
import { blacklistedServers, userData } from '@prisma/client';
import { EmbedBuilder, Snowflake } from 'discord.js';
import { emojis, colors } from '../utils/Constants.js';
import { logUnblacklist } from '../utils/HubLogger/ModLogs.js';

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
    type: 'user' | 'server',
    hubId: string,
    serverId: Snowflake,
  ): Promise<blacklistedServers | userData | null>;
  async removeBlacklist(
    type: 'server',
    hubId: string,
    serverId: Snowflake,
  ): Promise<blacklistedServers | null>;
  async removeBlacklist(type: 'user', hubId: string, userId: Snowflake): Promise<userData | null>;
  async removeBlacklist(type: 'user' | 'server', hubId: string, id: Snowflake) {
    this.scheduler.stopTask(`blacklist_${type}-${id}`);
    if (type === 'user') {
      const where = { userId: id, blacklistedFrom: { some: { hubId } } };
      const notInBlacklist = await db.userData.findFirst({ where });
      if (!notInBlacklist) return null;

      return await db.userData.update({
        where,
        data: { blacklistedFrom: { deleteMany: { where: { hubId } } } },
      });
    }
    else {
      const where = { serverId: id, hubs: { some: { hubId } } };
      const notInBlacklist = await db.blacklistedServers.findFirst({ where });
      if (!notInBlacklist) return null;

      return await db.blacklistedServers.update({
        where,
        data: { hubs: { deleteMany: { where: { hubId } } } },
      });
    }
  }

  /**
   * Schedule the removal of a user or server from the blacklist.
   * @param type The type of blacklist to remove. (user/server)
   * @param id The user or server ID to remove from the blacklist.
   * @param hubId The hub ID to remove the blacklist from.
   * @param expires The date or milliseconds to wait before removing the blacklist.
   */
  scheduleRemoval(
    type: 'user' | 'server',
    id: Snowflake,
    hubId: string,
    expires: Date | number,
  ): void {
    const name = `unblacklist_${type}-${id}`;
    if (this.scheduler.taskNames.includes(name)) this.scheduler.stopTask(name);

    const execute = async () => {
      await this.removeBlacklist(type, hubId, id);
      if (!SuperClient.instance?.user) return;
      await logUnblacklist(hubId, {
        type,
        targetId: id,
        mod: SuperClient.instance.user,
        reason: 'Blacklist duration expired.',
      });
    };

    this.scheduler.addTask(name, expires, execute);
  }

  /**
   * Notify a user or server that they have been blacklisted.
   * @param type The type of blacklist to notify. (user/server)
   * @param id The user or server ID to notify.
   * @param hubId The hub ID to notify.
   * @param expires The date after which the blacklist expires.
   * @param reason The reason for the blacklist.
   */
  async notifyBlacklist(
    type: 'user' | 'server',
    id: Snowflake,
    opts: {
      hubId: string,
      expires?: Date;
      reason?: string;
    },
  ): Promise<void> {
    const hub = await db.hubs.findUnique({ where: { id: opts.hubId } });
    const expireString = opts.expires
      ? `<t:${Math.round(opts.expires.getTime() / 1000)}:R>`
      : 'Never';
    const embed = new EmbedBuilder()
      .setTitle(`${emojis.blobFastBan} Blacklist Notification`)
      .setColor(colors.interchatBlue)
      .setFields(
        { name: 'Reason', value: opts.reason ?? 'No reason provided.', inline: true },
        { name: 'Expires', value: expireString, inline: true },
      );

    if (type === 'user') {
      embed.setDescription(`You have been blacklisted from talking in hub **${hub?.name}**.`);
      const user = await SuperClient.instance.users.fetch(id);
      await user.send({ embeds: [embed] }).catch(() => null);
    }
    else {
      embed.setDescription(
        `This server has been blacklisted from talking in hub **${hub?.name}**.`,
      );
      const serverConnected = await db.connectedList.findFirst({
        where: { serverId: id, hubId: opts.hubId },
      });

      if (!serverConnected) return;

      await SuperClient.instance.cluster.broadcastEval(
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
    const userBlacklisted = await db.userData.findFirst({
      where: { userId, blacklistedFrom: { some: { hubId } } },
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
    const client = SuperClient.instance;
    const user = await client.users.fetch(userId);
    if (typeof expires === 'number') expires = new Date(Date.now() + expires);

    const dbUser = await db.userData.findFirst({ where: { userId: user.id } });

    const hubs = dbUser?.blacklistedFrom.filter((i) => i.hubId !== hubId) || [];
    hubs?.push({ expires: expires ?? null, reason, hubId, moderatorId });

    const updatedUser = await db.userData.upsert({
      where: {
        userId: user.id,
      },
      update: {
        username: user.username,
        blacklistedFrom: { set: hubs },
      },
      create: {
        userId: user.id,
        username: user.username,
        blacklistedFrom: hubs,
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
    const guild = await SuperClient.instance.fetchGuild(serverId);
    if (!guild) return null;

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
