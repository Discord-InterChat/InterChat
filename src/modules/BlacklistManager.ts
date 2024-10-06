import BaseInfractionManager from '#main/modules/InfractionManager/BaseInfractionManager.js';
import { InfractionStatus, Prisma, ServerInfraction, UserInfraction } from '@prisma/client';
import { Snowflake } from 'discord.js';

export default class BlacklistManager<T extends UserInfraction | ServerInfraction> {
  readonly targetId: Snowflake;
  readonly infracManager;

  constructor(infracManager: BaseInfractionManager<T>) {
    this.targetId = infracManager.targetId;
    this.infracManager = infracManager;
  }

  public async addBlacklist(opts: {
    hubId: string;
    reason: string;
    moderatorId: string;
    serverName: string;
    expiresAt: Date | null;
  }): Promise<ServerInfraction | null>;
  public async addBlacklist(opts: {
    hubId: string;
    reason: string;
    moderatorId: string;
    expiresAt: Date | null;
  }): Promise<UserInfraction | null>;
  public async addBlacklist(opts: {
    hubId: string;
    reason: string;
    moderatorId: string;
    serverName: string;
    expiresAt: Date | null;
  }): Promise<UserInfraction | ServerInfraction | null> {
    const blacklisted = await this.fetchBlacklist(opts.hubId);

    if (blacklisted) {
      return await this.infracManager.updateInfraction(
        { hubId: opts.hubId, type: 'BLACKLIST', status: 'ACTIVE' },
        {
          dateIssued: new Date(),
          expiresAt: opts.expiresAt,
          reason: opts.reason,
          moderatorId: opts.moderatorId,
        },
      );
    }

    return await this.infracManager.addInfraction('BLACKLIST', opts);
  }

  public async removeBlacklist(
    hubId: string,
    status: Exclude<InfractionStatus, 'ACTIVE'> = 'REVOKED',
  ) {
    const exists = await this.fetchBlacklist(hubId);
    if (!exists) return null;

    return await this.infracManager.revokeInfraction('BLACKLIST', hubId, status);
  }

  public async updateBlacklist(
    hubId: string,
    data: Prisma.UserInfractionUpdateInput | Prisma.ServerInfractionUpdateInput,
  ) {
    const blacklisted = await this.fetchBlacklist(hubId);
    if (!blacklisted) return null;

    return await this.infracManager.updateInfraction(
      { hubId, type: 'BLACKLIST', status: 'ACTIVE' },
      data,
    );
  }

  public async fetchBlacklist(hubId: string) {
    const blacklist = await this.infracManager.fetchInfraction('BLACKLIST', hubId, 'ACTIVE');
    return blacklist;
  }
}
