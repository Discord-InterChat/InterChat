import db from '../utils/Db.js';
import Scheduler from '../services/SchedulerService.js';
import { emojis, colors } from '../utils/Constants.js';
import { logServerUnblacklist } from '../utils/HubLogger/ModLogs.js';
import { connectionCache } from '../utils/ConnectedList.js';
import { blacklistedServers } from '@prisma/client';
import { Collection, Snowflake, EmbedBuilder, Client } from 'discord.js';
import SuperClient from '../core/Client.js';
import { handleError } from '../utils/Utils.js';

export default class ServerBlacklisManager {
  private scheduler = new Scheduler();
  private cache = new Collection<string, blacklistedServers>();

  constructor() {
    this.scheduler = new Scheduler();
    this.cache = new Collection();

    this.scheduler.addRecurringTask('unblacklistUsers', 10_000, () => this.removeStaleBlacklists());
    this.scheduler.addRecurringTask('cacheUserBlacklists', 60 * 60 * 1000, () => this.cacheSoonExpiring());
  }


  private removeStaleBlacklists() {
    const filter = ({ expires }: { expires: Date | null }) => expires && expires <= new Date();
    const servers = this.cache.filter((server) => server.hubs.some(filter));
    if (servers?.size === 0) return;

    servers.forEach((server) => {
      const blacklists = server.hubs.filter(filter);
      if (!blacklists) return;

      blacklists.forEach(async ({ hubId }) => {
        const client = SuperClient.instance;
        if (client?.user) {
          await logServerUnblacklist(client, hubId, {
            serverId: server.serverId,
            mod: client.user,
            reason: 'Blacklist duration expired.',
          }).catch(handleError);
        }

        await this.removeBlacklist(hubId, server.serverId);
        this.cache.delete(server.serverId);
      });
    });
  }

  private async cacheSoonExpiring() {
    const currentTime = new Date();
    const twelveHoursLater = new Date(currentTime.getTime() + 12 * 60 * 60 * 1000);

    const servers = await db.blacklistedServers.findMany({
      where: {
        hubs: {
          some: {
            expires: { gte: currentTime, lte: twelveHoursLater },
          },
        },
      },
    });

    servers.forEach((server) => this.cache.set(server.serverId, server));
  }

  async removeBlacklist(hubId: string, id: Snowflake) {
    this.scheduler.stopTask(`blacklist_server::${id}`);

    const where = { serverId: id, hubs: { some: { hubId } } };
    const notInBlacklist = await db.blacklistedServers.findFirst({ where });
    if (!notInBlacklist) return null;

    const res = await db.blacklistedServers.update({
      where,
      data: { hubs: { deleteMany: { where: { hubId } } } },
    });

    this.cache.delete(notInBlacklist.serverId);
    return res;
  }
  /**
   * Add a server to the blacklist.
   * @param server The ID or instance of the server to blacklist.
   * @param hubId The ID of the hub to add the blacklist to.
   * @param reason The reason for the blacklist.
   * @param expires The date after which the blacklist will expire.
   * @returns The created blacklist.
   */
  async addBlacklist(
    server: { id: Snowflake; name: string },
    hubId: string,
    { reason, moderatorId, expires }: { reason: string; moderatorId: Snowflake; expires?: Date },
  ) {
    const createdRes = await db.blacklistedServers.upsert({
      where: {
        serverId: server.id,
      },
      update: {
        serverName: server.name,
        hubs: { push: { hubId, expires, reason, moderatorId } },
      },
      create: {
        serverId: server.id,
        serverName: server.name,
        hubs: [{ hubId, expires, reason, moderatorId }],
      },
    });

    this.cache.set(createdRes.serverId, createdRes);
    return createdRes;
  }
  /**
   * Fetch a server blacklist from the database.
   * @param hubId The hub ID to fetch the blacklist from.
   * @param serverId The ID of the blacklisted serverId.
   */
  async fetchBlacklist(hubId: string, serverId: string) {
    const data =
      this.cache.find((v) => v.hubs.some((h) => h.hubId === hubId) && v.serverId === serverId) ??
      (await db.blacklistedServers.findFirst({ where: { serverId, hubs: { some: { hubId } } } }));

    if (data && !this.cache.has(data.serverId)) this.cache.set(data.serverId, data);

    return data;
  }
  /**
   * Notify a user or server that they have been blacklisted.
   * @param type The type of blacklist to notify. (user/server)
   * @param id The user or server ID to notify.
   * @param hubId The hub ID to notify.
   * @param expires The date after which the blacklist expires.
   * @param reason The reason for the blacklist.
   */
  async notifyServer(
    client: Client,
    id: Snowflake,
    opts: {
      hubId: string;
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
      .setDescription(`This server has been blacklisted from talking in hub **${hub?.name}**.`)
      .setColor(colors.interchatBlue)
      .setFields(
        { name: 'Reason', value: opts.reason ?? 'No reason provided.', inline: true },
        { name: 'Expires', value: expireString, inline: true },
      );

    const serverConnected =
      connectionCache.find(({ serverId, hubId }) => serverId === id && hubId === opts.hubId) ??
      (await db.connectedList.findFirst({
        where: { serverId: id, hubId: opts.hubId },
      }));

    if (!serverConnected) return;

    await client.cluster.broadcastEval(
      async (_client, ctx) => {
        const channel = await _client.channels.fetch(ctx.channelId).catch(() => null);
        if (!channel?.isTextBased()) return;

        await channel.send({ embeds: [ctx.embed] }).catch(() => null);
      },
      { context: { channelId: serverConnected.channelId, embed: embed.toJSON() } },
    );
  }
}
