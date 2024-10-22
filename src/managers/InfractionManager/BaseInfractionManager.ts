import { cacheData, getCachedData } from '#utils/CacheUtils.js';
import {
  InfractionStatus,
  InfractionType,
  Prisma,
  ServerInfraction,
  UserInfraction,
} from '@prisma/client';
import { type Client, type Snowflake, type User } from 'discord.js';
import { isDate } from 'util/types';

export default abstract class BaseInfractionManager<T extends UserInfraction | ServerInfraction> {
  protected abstract modelName: 'UserInfraction' | 'ServerInfraction';
  public readonly targetId: Snowflake;
  private readonly cacheExpirySecs = 5 * 60;

  constructor(targetId: Snowflake) {
    this.targetId = targetId;
  }

  public abstract addInfraction(
    type: InfractionType,
    opts: {
      hubId: string;
      reason: string;
      moderatorId: Snowflake;
      expiresAt: Date | null;
    },
  ): Promise<T>;

  public abstract removeInfraction(type: InfractionType, hubId: string): Promise<T | null>;

  public abstract updateInfraction(
    filter: { type: InfractionType; hubId: string; status?: InfractionStatus },
    data: Prisma.UserInfractionUpdateInput | Prisma.ServerInfractionUpdateInput,
  ): Promise<T | null>;

  protected abstract queryEntityInfractions(hubId: string): Promise<T[]>;

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

  public abstract logUnblacklist(
    client: Client,
    hubId: string,
    id: string,
    opts: { mod: User; reason?: string },
  ): Promise<void>;

  protected async refreshCache(hubId: string) {
    const key = `${this.modelName}:${this.targetId}:${hubId}`;
    const infractions = await this.queryEntityInfractions(hubId);
    await cacheData(key, JSON.stringify(infractions), this.cacheExpirySecs);
  }

  protected async cacheEntity(entity: T) {
    const entitySnowflake = 'userId' in entity ? entity.userId : entity.serverId;
    const key = `${this.modelName}:${entitySnowflake}:${entity.hubId}`;
    const existing = (await this.getHubInfractions(entity.hubId, { type: entity.type })).filter(
      (i) => i.id !== entity.id,
    );

    return cacheData(key, JSON.stringify([...existing, entity]), this.cacheExpirySecs);
  }

  protected async removeCachedEntity(entity: T) {
    const existingInfractions = await this.getHubInfractions(entity.hubId, { type: entity.type });
    const entitySnowflake = 'userId' in entity ? entity.userId : entity.serverId;
    return cacheData(
      `${this.modelName}:${entitySnowflake}:${entity.hubId}`,
      JSON.stringify(existingInfractions.filter((i) => i.id !== entity.id)),
      this.cacheExpirySecs,
    );
  }

  protected updateInfractionDates(infractions: ConvertDatesToString<T>[]) {
    if (infractions.length === 0) return [];
    else if (isDate(infractions[0].dateIssued)) return infractions as T[];

    return infractions.map((infrac) => ({
      ...infrac,
      dateIssued: new Date(infrac.dateIssued),
      appealedAt: infrac.appealedAt ? new Date(infrac.appealedAt) : null,
      expiresAt: infrac.expiresAt ? new Date(infrac.expiresAt) : null,
    }));
  }

  public filterValidInfractions(infractions: UserInfraction[]): UserInfraction[] {
    return infractions.filter(({ expiresAt }) => !expiresAt || expiresAt > new Date()) ?? [];
  }

  public isExpiredInfraction(infraction: T | null) {
    return !infraction || (!!infraction.expiresAt && infraction.expiresAt <= new Date());
  }
}
