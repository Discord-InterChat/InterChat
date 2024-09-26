import { cacheData, getCachedData } from '#main/utils/cache/cacheUtils.js';
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

  public async getHubInfractions(type: InfractionType, hubId: string): Promise<T[]> {
    const fetched = await getCachedData(
      `${this.modelName}:${this.targetId}:${hubId}`,
      async () => await this.queryEntityInfractions(hubId),
      this.cacheExpirySecs,
    );

    const infractionsArr = fetched.data?.filter((i) => i.type === type);
    if (!infractionsArr) return [];

    return this.updateInfractionDates(infractionsArr);
  }

  public async fetchInfraction(type: InfractionType, hubId: string, status?: InfractionStatus) {
    const infractions = await this.getHubInfractions(type, hubId);
    const infraction = infractions.find(
      (i) => (status ? i.status === status : true) && i.type === type,
    );

    return infraction ?? null;
  }

  public async revokeInfraction(
    type: InfractionType,
    hubId: string,
    status: InfractionStatus = 'ACTIVE',
  ) {
    const revoked = await this.updateInfraction(
      { type, hubId, status },
      { status: 'REVOKED', revokedAt: new Date() },
    );

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
    const existing = (await this.getHubInfractions(entity.type, entity.hubId)).filter(
      (i) => i.id !== entity.id,
    );

    return cacheData(key, JSON.stringify([...existing, entity]), this.cacheExpirySecs);
  }

  protected async removeCachedEntity(entity: T) {
    const existingInfractions = await this.getHubInfractions(entity.type, entity.hubId);
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
      expiresAt: infrac.expiresAt ? new Date(infrac.expiresAt) : null,
      revokedAt: infrac.revokedAt ? new Date(infrac.revokedAt) : null,
    })) as T[];
  }

  public filterValidInfractions(infractions: UserInfraction[]): UserInfraction[] {
    return infractions.filter(({ expiresAt }) => !expiresAt || expiresAt > new Date()) ?? [];
  }

  public isExpiredInfraction(infraction: T | null) {
    if (!infraction) return true;
    else if (!infraction.expiresAt || infraction.expiresAt > new Date()) return false;
    return true;
  }
}
