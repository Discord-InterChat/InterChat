import BaseInfractionManager from './BaseInfractionManager.js';
import db from '#utils/Db.js';
import { logServerUnblacklist } from '#utils/HubLogger/ModLogs.js';
import type { InfractionStatus, InfractionType, Prisma, ServerInfraction } from '@prisma/client';
import { type Client, type Snowflake, type User } from 'discord.js';

interface AddInfractionOpts {
  hubId: string;
  serverName: string;
  reason: string;
  moderatorId: Snowflake;
  expiresAt: Date | null;
}

export default class ServerInfractionManager extends BaseInfractionManager<ServerInfraction> {
  protected readonly modelName = 'ServerInfraction';

  protected async queryEntityInfractions(hubId: string) {
    return await db.serverInfraction.findMany({
      where: { serverId: this.targetId, hubId },
      orderBy: { dateIssued: 'desc' },
    });
  }

  public async revokeInfraction(type: InfractionType, hubId: string) {
    const infraction = await this.fetchInfraction(type, hubId);
    if (!infraction) return null;

    const revoked = await db.serverInfraction.update({
      where: { id: infraction.id },
      data: { status: 'REVOKED' },
    });

    this.cacheEntity(revoked);

    return revoked;
  }

  public override async logUnblacklist(
    client: Client,
    id: string,
    hubId: string,
    { mod, reason }: { mod: User; reason?: string },
  ) {
    await logServerUnblacklist(client, hubId, { id, mod, reason });
  }

  /**
   * Add a server to the blacklist.
   * @param server The ID or instance of the server to blacklist.
   * @param hubId The ID of the hub to add the blacklist to.
   * @param reason The reason for the blacklist.
   * @param expires The date after which the blacklist will expire.
   * @returns The created blacklist.
   */
  public override async addInfraction(
    type: InfractionType,
    { hubId, serverName, reason, moderatorId, expiresAt }: AddInfractionOpts,
  ) {
    const blacklist = await db.serverInfraction.create({
      data: { serverId: this.targetId, serverName, type, expiresAt, reason, moderatorId, hubId },
    });

    this.cacheEntity(blacklist);
    return blacklist;
  }

  public override async updateInfraction(
    filter: { type: InfractionType; hubId: string; status?: InfractionStatus },
    data: Prisma.ServerInfractionUpdateInput,
  ) {
    const infraction = await this.fetchInfraction(filter.type, filter.hubId, filter.status);
    if (!infraction) return null;

    const updated = await db.serverInfraction.update({ where: { id: infraction.id }, data });
    this.cacheEntity(updated);
    return updated;
  }

  public override async removeInfraction(type: InfractionType, hubId: string) {
    const infraction = await this.fetchInfraction(type, hubId);
    if (!infraction) return null;

    const server = await db.serverInfraction.delete({ where: { id: infraction.id } });

    this.removeCachedEntity(infraction);
    return server;
  }
}
