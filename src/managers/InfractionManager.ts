import { isDate } from 'node:util/types';
import type { Infraction, InfractionStatus, InfractionType, Prisma } from '@prisma/client';
import type { Client, Snowflake, User } from 'discord.js';
import { HubService } from '#main/services/HubService.js';
import db from '#main/utils/Db.js';
import { logServerUnblacklist, logUserUnblacklist } from '#main/utils/hub/logger/ModLogs.js';
import type { ConvertDatesToString } from '#types/Utils.d.ts';
import { cacheData, getCachedData } from '#utils/CacheUtils.js';

export default class InfractionManager {
  public readonly targetId: Snowflake;
  public readonly targetType: 'user' | 'server';

  private readonly modelName = 'Infraction';
  private readonly cacheExpirySecs = 5 * 60;

  constructor(targetType: 'user' | 'server', targetId: Snowflake) {
    this.targetId = targetId;
    this.targetType = targetType;
  }

  private getKey(entityId: Snowflake, hubId: string) {
    return `${this.modelName}:${entityId}:${hubId}`;
  }

  public async addInfraction(
    type: InfractionType,
    opts: {
      serverName?: string;
      hubId: string;
      reason: string;
      moderatorId: Snowflake;
      expiresAt: Date | null;
    },
  ) {
    const infraction = await db.infraction.create({
      data: {
        ...opts,
        userId: this.targetType === 'user' ? this.targetId : undefined,
        serverId: this.targetType === 'server' ? this.targetId : undefined,
        serverName: opts.serverName,
        type,
      },
    });

    await this.cacheEntity(infraction);

    return infraction;
  }

  public async removeInfraction(type: InfractionType, hubId: string) {
    const infraction = await this.fetchInfraction(type, hubId);
    if (!infraction) return null;

    const entity = await db.infraction.delete({ where: { id: infraction.id } });

    this.removeCachedInfraction(infraction);
    return entity;
  }

  public async updateInfraction(
    filter: { type: InfractionType; hubId: string; status?: InfractionStatus },
    data: Prisma.InfractionUpdateInput,
  ) {
    const infraction = await this.fetchInfraction(filter.type, filter.hubId, filter.status);
    if (!infraction) return null;

    const updated = await db.infraction.update({
      where: { id: infraction.id },
      data,
    });
    this.cacheEntity(updated);
    return updated;
  }

  private async queryEntityInfractions(hubId: string) {
    if (this.targetType === 'user') {
      return await db.infraction.findMany({
        where: { userId: this.targetId, hubId },
        orderBy: { createdAt: 'desc' },
      });
    }

    return await db.infraction.findMany({
      where: { serverId: this.targetId, hubId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async getHubInfractions(hubId: string, opts?: { type?: InfractionType; count?: number }) {
    const fetched = await getCachedData(
      `${this.modelName}:${this.targetId}:${hubId}`,
      async () => await this.queryEntityInfractions(hubId),
      this.cacheExpirySecs,
    );

    let infractionsArr = fetched.data ?? [];
    if (opts?.type) infractionsArr = infractionsArr.filter((i) => i.type === opts.type);
    if (opts?.count) infractionsArr = infractionsArr.slice(0, opts.count);

    return this.updateInfractionDates(infractionsArr);
  }

  public async fetchInfraction(type: InfractionType, hubId: string, status?: InfractionStatus) {
    const infractions = await this.getHubInfractions(hubId, { type });
    const infraction = infractions.find(
      (i) => (status ? i.status === status : true) && i.type === type,
    );

    return infraction ?? null;
  }

  public async revokeInfraction(
    type: InfractionType,
    hubId: string,
    status: Exclude<InfractionStatus, 'ACTIVE'> = 'REVOKED',
  ) {
    const revoked = await this.updateInfraction({ type, hubId, status: 'ACTIVE' }, { status });
    return revoked;
  }

  public async logUnblacklist(
    client: Client,
    hubId: string,
    id: string,
    opts: { mod: User; reason?: string },
  ) {
    const hub = await new HubService().fetchHub(hubId);
    if (!hub) return;

    if (this.targetType === 'user') {
      await logUserUnblacklist(client, hub, {
        id,
        mod: opts.mod,
        reason: opts.reason,
      });
    }
    else {
      await logServerUnblacklist(client, hub, {
        id,
        mod: opts.mod,
        reason: opts.reason,
      });
    }
  }

  protected async refreshCache(hubId: string) {
    const key = this.getKey(this.targetId, hubId);
    const infractions = await this.queryEntityInfractions(hubId);
    await cacheData(key, JSON.stringify(infractions), this.cacheExpirySecs);
  }

  protected async cacheEntity(entity: Infraction) {
    const entitySnowflake = entity.userId ?? entity.serverId;
    const key = this.getKey(entitySnowflake as string, entity.hubId);
    const existing = (await this.getHubInfractions(entity.hubId, { type: entity.type })).filter(
      (i) => i.id !== entity.id,
    );

    return cacheData(key, JSON.stringify([...existing, entity]), this.cacheExpirySecs);
  }

  protected async removeCachedInfraction(entity: Infraction) {
    const existingInfractions = await this.getHubInfractions(entity.hubId, {
      type: entity.type,
    });
    const entitySnowflake = entity.userId ?? entity.serverId;
    return cacheData(
      this.getKey(entitySnowflake as string, entity.hubId),
      JSON.stringify(existingInfractions.filter((i) => i.id !== entity.id)),
      this.cacheExpirySecs,
    );
  }

  protected updateInfractionDates(infractions: ConvertDatesToString<Infraction>[]) {
    if (infractions.length === 0) {
      return [];
    }
    if (infractions.every((i) => isDate(i.createdAt))) {
      return infractions as unknown as Infraction[];
    }

    const fixedInfractions: Infraction[] = infractions.map((infrac) => ({
      ...infrac,
      createdAt: new Date(infrac.createdAt),
      updatedAt: new Date(infrac.updatedAt),
      appealedAt: infrac.appealedAt ? new Date(infrac.appealedAt) : null,
      expiresAt: infrac.expiresAt ? new Date(infrac.expiresAt) : null,
    }));

    return fixedInfractions;
  }

  public filterValidInfractions(infractions: Infraction[]): Infraction[] {
    return infractions.filter(({ expiresAt }) => !expiresAt || expiresAt > new Date()) ?? [];
  }

  public isExpiredInfraction(infraction: Infraction | null) {
    return !infraction?.expiresAt || infraction.expiresAt <= new Date();
  }
}
