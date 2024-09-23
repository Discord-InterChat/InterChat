import BaseBlacklistManager from '#main/core/BaseBlacklistManager.js';
import { getHubConnections } from '#main/utils/ConnectedListUtils.js';
import db from '#main/utils/Db.js';
import { getCachedData } from '#main/utils/cache/cacheUtils.js';
import { logServerUnblacklist } from '#main/utils/HubLogger/ModLogs.js';
import { blacklistedServers, hubBlacklist } from '@prisma/client';
import { Snowflake, User } from 'discord.js';

export default class ServerBlacklisManager extends BaseBlacklistManager<blacklistedServers> {
  protected modelName = 'blacklistedServers' as const;

  private serializeBlacklist(
    blacklist: ConvertDatesToString<blacklistedServers>,
  ): blacklistedServers {
    return {
      ...blacklist,
      blacklistedFrom: blacklist.blacklistedFrom.map((b) => ({
        ...b,
        expires: b.expires ? new Date(b.expires) : null,
      })),
    };
  }

  public override async fetchBlacklist(hubId: string, id: string) {
    const { data: blacklist, fromCache } = await getCachedData(
      `${this.modelName}:${id}`,
      async () => await db.blacklistedServers.findFirst({ where: { id } }),
    );

    if (blacklist?.blacklistedFrom.some((h) => h.hubId === hubId)) {
      if (!fromCache) this.addToCache(blacklist);
      return this.serializeBlacklist(blacklist);
    }
    return null;
  }
  public override async logUnblacklist(
    hubId: string,
    id: string,
    { mod, reason }: { mod: User; reason?: string },
  ) {
    await logServerUnblacklist(this.client, hubId, { id, mod, reason });
  }

  /**
   * Add a server to the blacklist.
   * @param server The ID or instance of the server to blacklist.
   * @param hubId The ID of the hub to add the blacklist to.
   * @param reason The reason for the blacklist.
   * @param expires The date after which the blacklist will expire.
   * @returns The created blacklist.
   */
  public override async addBlacklist(
    server: { id: Snowflake; name: string },
    hubId: string,
    {
      reason,
      moderatorId,
      expires,
    }: { reason: string; moderatorId: Snowflake; expires: Date | null },
  ) {
    const blacklistedFrom: hubBlacklist = { hubId, expires, reason, moderatorId };
    const blacklist = await db.blacklistedServers.upsert({
      where: { id: server.id },
      update: { serverName: server.name, blacklistedFrom: { push: blacklistedFrom } },
      create: { id: server.id, serverName: server.name, blacklistedFrom: [blacklistedFrom] },
    });

    this.addToCache(blacklist);
    return blacklist;
  }

  public override async removeBlacklist(hubId: string, id: Snowflake) {
    if (!(await this.fetchBlacklist(hubId, id))) return null;

    const updatedBlacklist = await db.blacklistedServers.update({
      where: { id },
      data: { blacklistedFrom: { deleteMany: { where: { hubId } } } },
    });

    this.addToCache(updatedBlacklist);
    return updatedBlacklist;
  }
  /**
   * Notify a user or server that they have been blacklisted.
   * @param type The type of blacklist to notify. (user/server)
   * @param id The user or server ID to notify.
   * @param hubId The hub ID to notify.
   * @param expires The date after which the blacklist expires.
   * @param reason The reason for the blacklist.
   */
  async sendNotification(opts: {
    target: { id: Snowflake };
    hubId: string;
    expires: Date | null;
    reason?: string;
  }): Promise<void> {
    const hub = await db.hubs.findUnique({ where: { id: opts.hubId } });
    const embed = this.buildNotifEmbed(
      `This server has been blacklisted from talking in hub **${hub?.name}**.`,
      { expires: opts.expires, reason: opts.reason },
    );

    const serverInHub =
      (await getHubConnections(opts.hubId))?.find((con) => con.serverId === opts.target.id) ??
      (await db.connectedList.findFirst({
        where: { serverId: opts.target.id, hubId: opts.hubId },
      }));

    if (!serverInHub) return;

    await this.client.cluster.broadcastEval(
      async (_client, ctx) => {
        const channel = await _client.channels.fetch(ctx.channelId).catch(() => null);
        if (!_client.isGuildTextBasedChannel(channel)) return;

        await channel.send({ embeds: [ctx.embed] }).catch(() => null);
      },
      { context: { channelId: serverInHub.channelId, embed: embed.toJSON() } },
    );
  }
}
