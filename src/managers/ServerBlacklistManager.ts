import db from '../utils/Db.js';
import BaseBlacklistManager from '../core/BaseBlacklistManager.js';
import { blacklistedServers, hubBlacklist, Prisma } from '@prisma/client';
import { Snowflake, User } from 'discord.js';
import { logServerUnblacklist } from '../utils/HubLogger/ModLogs.js';
import { getAllConnections } from '../utils/ConnectedList.js';
import { getCachedData } from '#main/utils/db/cacheUtils.js';

export default class ServerBlacklisManager extends BaseBlacklistManager<blacklistedServers> {
  protected modelName: Prisma.ModelName = 'blacklistedServers';

  public override async fetchBlacklist(hubId: string, id: string) {
    const blacklist = await getCachedData(
      `${this.modelName}:${id}`,
      async () => await db.blacklistedServers.findFirst({ where: { id } }),
    );

    return blacklist?.blacklistedFrom.find((h) => h.hubId === hubId) ? blacklist : null;
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
    const createdRes = await db.blacklistedServers.upsert({
      where: { id: server.id },
      update: { serverName: server.name, blacklistedFrom: { push: blacklistedFrom } },
      create: { id: server.id, serverName: server.name, blacklistedFrom: [blacklistedFrom] },
    });
    return createdRes;
  }

  public override async removeBlacklist(hubId: string, id: Snowflake) {
    const where = { id, blacklistedFrom: { some: { hubId } } };
    const notInBlacklist = await db.blacklistedServers.findFirst({ where });
    if (!notInBlacklist) return null;

    const res = await db.blacklistedServers.update({
      where,
      data: { blacklistedFrom: { deleteMany: { where: { hubId } } } },
    });
    return res;
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

    const serverConnected =
      (await getAllConnections())?.find(
        (con) => con.serverId === opts.target.id && con.hubId === opts.hubId,
      ) ??
      (await db.connectedList.findFirst({
        where: { serverId: opts.target.id, hubId: opts.hubId },
      }));

    if (!serverConnected) return;

    await this.client.cluster.broadcastEval(
      async (_client, ctx) => {
        const channel = await _client.channels.fetch(ctx.channelId).catch(() => null);
        if (!channel?.isTextBased()) return;

        await channel.send({ embeds: [ctx.embed] }).catch(() => null);
      },
      { context: { channelId: serverConnected.channelId, embed: embed.toJSON() } },
    );
  }
}
