import type { BlockWord, Hub } from '@prisma/client';
import type { Redis } from 'ioredis';
import { CacheConfig, CacheManager } from '#main/managers/CacheManager.js';
import HubConnectionsManager from '#main/managers/HubConnectionsManager.js';
import HubLogManager from '#main/managers/HubLogManager.js';
import HubModeratorManager from '#main/managers/HubModeratorManager.js';
import HubSettingsManager from '#main/managers/HubSettingsManager.js';
import { HubService } from '#main/services/HubService.js';
import { RedisKeys } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import Logger from '#main/utils/Logger.js';
import getRedis from '#main/utils/Redis.js';

export default class HubManager {
  private readonly cacheManager: CacheManager;
  private readonly components: {
    hubService: HubService;
    moderators: HubModeratorManager;
    settings: HubSettingsManager;
    connections: HubConnectionsManager;
    logs: HubLogManager | null;
  };
  private hub: Hub;

  constructor(
    hub: Hub,
    config: Partial<{
      hubService: HubService;
      modManager: HubModeratorManager;
      cache: Redis;
      cacheConfig: CacheConfig;
    }> = {},
  ) {
    this.hub = hub;
    this.cacheManager = new CacheManager(config.cache ?? getRedis(), {
      expirationMs: 10 * 60 * 1000, // 10 minutes
      prefix: RedisKeys.Hub,
      ...config.cacheConfig,
    });

    this.components = {
      hubService: config.hubService ?? new HubService(),
      moderators: config.modManager ?? new HubModeratorManager(this, this.cacheManager.redis),
      settings: new HubSettingsManager(this),
      connections: new HubConnectionsManager(this, this.cacheManager.redis),
      logs: null, // Lazy loaded
    };

    this.initializeCache().catch(Logger.error);
  }

  // Public accessors
  public get id(): string {
    return this.hub.id;
  }

  public get data(): Hub {
    return this.hub;
  }

  public get settings(): HubSettingsManager {
    return this.components.settings;
  }

  public get moderators(): HubModeratorManager {
    return this.components.moderators;
  }

  public get connections(): HubConnectionsManager {
    return this.components.connections;
  }

  private async initializeCache(): Promise<void> {
    await this.cacheManager.set(this.hub.id, this.hub);
  }

  // Data operations
  public async update(
    data: Partial<
      Pick<
        Hub,
        | 'description'
        | 'iconUrl'
        | 'bannerUrl'
        | 'private'
        | 'locked'
        | 'appealCooldownHours'
        | 'settings'
      >
    >,
  ): Promise<void> {
    this.hub = await db.hub.update({
      where: { id: this.hub.id },
      data,
    });
    await this.initializeCache();
  }

  public async delete(): Promise<void> {
    await this.components.hubService.deleteHub(this.hub.id);
  }

  public async createInvite(expires: Date) {
    return await db.hubInvite.create({
      data: {
        hub: { connect: { id: this.hub.id } },
        expires,
      },
    });
  }

  public async fetchBlockWords(): Promise<BlockWord[]> {
    return await this.cacheManager.getSetMembers<BlockWord>(
      'blockWords',
      async () => await db.blockWord.findMany({ where: { hubId: this.hub.id } }),
    );
  }

  public async fetchInvites() {
    return await db.hubInvite.findMany({
      where: { hubId: this.hub.id },
    });
  }

  public async fetchLogConfig() {
    if (!this.components.logs) {
      this.components.logs = await HubLogManager.create(this.hub.id);
    }
    return this.components.logs;
  }

  // Authorization methods
  public isOwner(userId: string): boolean {
    return this.data.ownerId === userId;
  }

  public async isManager(userId: string): Promise<boolean> {
    return await this.components.moderators.checkStatus(userId, ['MANAGER']);
  }

  public async isMod(userId: string): Promise<boolean> {
    return await this.components.moderators.checkStatus(userId);
  }
}
