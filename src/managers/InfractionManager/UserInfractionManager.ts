import db from '#utils/Db.js';
import { logUserUnblacklist } from '#utils/hub/logger/ModLogs.js';
import type { InfractionStatus, InfractionType, Prisma, UserInfraction } from '@prisma/client';
import { type Client, type Snowflake, type User } from 'discord.js';
import BaseInfractionManager from './BaseInfractionManager.js';

interface AddInfractionOpts {
  hubId: string;
  reason: string;
  moderatorId: Snowflake;
  expiresAt: Date | null;
}

export default class UserInfractionManager extends BaseInfractionManager<UserInfraction> {
  protected readonly modelName = 'UserInfraction';

  protected async queryEntityInfractions(hubId: string) {
    return await db.userInfraction.findMany({
      where: { userId: this.targetId, hubId },
      orderBy: { dateIssued: 'desc' },
    });
  }

  public override async logUnblacklist(
    client: Client,
    hubId: string,
    id: string,
    { mod, reason }: { mod: User; reason?: string },
  ) {
    await logUserUnblacklist(client, hubId, { id, mod, reason });
  }

  async addInfraction(
    type: InfractionType,
    { hubId, reason, moderatorId, expiresAt }: AddInfractionOpts,
  ) {
    // if already blacklisted, override it, otherwise add a new one
    const infraction = await db.userInfraction.create({
      data: {
        userData: {
          connectOrCreate: { where: { id: this.targetId }, create: { id: this.targetId } },
        },
        hub: { connect: { id: hubId } },
        type,
        expiresAt,
        reason,
        moderatorId,
      },
    });

    this.refreshCache(hubId);

    return infraction;
  }

  async removeInfraction(type: InfractionType, hubId: string) {
    const infraction = await this.fetchInfraction(type, hubId);
    if (!infraction) return null;

    const user = await db.userInfraction.delete({ where: { id: infraction.id } });

    this.removeCachedEntity(infraction);
    return user;
  }

  public async updateInfraction(
    filter: { type: InfractionType; hubId: string; status?: InfractionStatus },
    data: Prisma.UserInfractionUpdateInput,
  ) {
    const infraction = await this.fetchInfraction(filter.type, filter.hubId, filter.status);
    if (!infraction) return null;

    const updated = await db.userInfraction.update({ where: { id: infraction.id }, data });
    this.cacheEntity(updated);
    return updated;
  }
}
