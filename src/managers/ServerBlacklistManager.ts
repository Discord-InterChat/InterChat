import db from '../utils/Db.js';
import { emojis, colors } from '../utils/Constants.js';
import { connectionCache } from '../utils/ConnectedList.js';
import { blacklistedServers } from '@prisma/client';
import BaseBlacklistManager from '../core/BaseBlacklistManager.js';
import { Client, EmbedBuilder, Snowflake } from 'discord.js';
import SuperClient from '../core/Client.js';
import { logServerUnblacklist } from '../utils/HubLogger/ModLogs.js';
import { handleError } from '../utils/Utils.js';

export default class ServerBlacklisManager extends BaseBlacklistManager<blacklistedServers> {
  protected override async fetchEntityFromDb(hubId: string, entityId: string) {
    return await db.blacklistedServers.findFirst({
      where: { id: entityId, blacklistedFrom: { some: { hubId } } },
    });
  }
  protected override async logUnblacklist(client: SuperClient, hubId: string, serverId: string) {
    if (!client?.user) return;

    await logServerUnblacklist(client, hubId, {
      serverId,
      mod: client.user,
      reason: 'Blacklist duration expired.',
    }).catch(handleError);
  }

  protected override async fetchExpiringEntities() {
    const currentTime = new Date();
    const twelveHoursLater = new Date(currentTime.getTime() + 12 * 60 * 60 * 1000);

    return await db.blacklistedServers.findMany({
      where: {
        blacklistedFrom: { some: { expires: { gte: currentTime, lte: twelveHoursLater } } },
      },
    });
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
    { reason, moderatorId, expires }: { reason: string; moderatorId: Snowflake; expires?: Date },
  ) {
    const blacklistedFrom = { hubId, expires, reason, moderatorId };
    const createdRes = await db.blacklistedServers.upsert({
      where: { id: server.id },
      update: { serverName: server.name, blacklistedFrom: { push: blacklistedFrom } },
      create: { id: server.id, serverName: server.name, blacklistedFrom: [blacklistedFrom] },
    });

    this.cache.set(createdRes.id, createdRes);
    return createdRes;
  }

  public override async removeBlacklist(hubId: string, id: Snowflake) {
    const where = { id, hubs: { some: { hubId } } };
    const notInBlacklist = await db.blacklistedServers.findFirst({ where });
    if (!notInBlacklist) return null;

    const res = await db.blacklistedServers.update({
      where,
      data: { blacklistedFrom: { deleteMany: { where: { hubId } } } },
    });

    this.cache.delete(notInBlacklist.id);
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
