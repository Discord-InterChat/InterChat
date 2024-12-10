import HubLogManager from '#main/managers/HubLogManager.js';
import HubModeratorManager from '#main/managers/HubModeratorManager.js';
import HubSettingsManager from '#main/managers/HubSettingsManager.js';
import { HubService } from '#main/services/HubService.js';
import { getHubConnections } from '#main/utils/ConnectedListUtils.js';
import { RedisKeys } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import Logger from '#main/utils/Logger.js';
import getRedis from '#main/utils/Redis.js';
import { BlockWord, Hub, HubModerator } from '@prisma/client';
import { Redis } from 'ioredis';

export default class HubManager {
  public readonly id: string;

  private readonly cache: Redis;
  private readonly hubService: HubService;
  private readonly settingsManager: HubSettingsManager;
  private readonly modManager: HubModeratorManager;

  private readonly blockWordsKey: `${RedisKeys.Hub}:${string}:blockWords`;
  private readonly expirationSeconds = 10 * 60 * 1000; // 10 mins

  private hub: Hub;
  private logManager: HubLogManager | null = null;

  constructor(
    hub: Hub,
    hubService = new HubService(),
    modManager = new HubModeratorManager(this),
    cache: Redis = getRedis(),
  ) {
    this.hub = hub;
    this.id = hub.id;
    this.settingsManager = new HubSettingsManager(this);

    this.blockWordsKey = `${RedisKeys.Hub}:${hub.id}:blockWords`;

    this.cache = cache;
    this.hubService = hubService;
    this.modManager = modManager;

    this.cacheHub().catch(Logger.error);
  }

  private async cacheHub() {
    await this.cache.set(
      `${this.hubService.hubKey}${this.hub.id}`,
      JSON.stringify(this.hub),
      'EX',
      this.expirationSeconds,
    );
  }

  public get data() {
    return this.hub;
  }

  public get moderators() {
    return this.modManager;
  }

  async delete() {
    await this.hubService.deleteHub(this.hub.id);
  }
  async setDescription(description: string) {
    this.hub = await db.hub.update({ where: { id: this.hub.id }, data: { description } });
    this.cacheHub();
  }

  async setIconUrl(iconUrl: string) {
    this.hub = await db.hub.update({ where: { id: this.hub.id }, data: { iconUrl } });
    this.cacheHub();
  }

  async setBannerUrl(bannerUrl: string | null) {
    this.hub = await db.hub.update({ where: { id: this.hub.id }, data: { bannerUrl } });
    this.cacheHub();
  }

  async setPrivate(isPrivate: boolean) {
    this.hub = await db.hub.update({ where: { id: this.hub.id }, data: { private: isPrivate } });
    this.cacheHub();
  }

  async setLocked(locked: boolean) {
    this.hub = await db.hub.update({ where: { id: this.hub.id }, data: { locked } });
    this.cacheHub();
  }
  async setAppealCooldownHours(appealCooldownHours: number) {
    this.hub = await db.hub.update({ where: { id: this.hub.id }, data: { appealCooldownHours } });
    this.cacheHub();
  }

  async createInvite(expires: Date) {
    const createdInvite = await db.hubInvite.create({
      data: {
        hub: { connect: { id: this.hub.id } },
        expires,
      },
    });

    return createdInvite;
  }

  /**
   * This method is made specifically for the HubSettingsManager to update settings
   * @param settings - Bitfield of settings
   */
  async setSettings(settings: number) {
    this.hub = await db.hub.update({ where: { id: this.hub.id }, data: { settings } });
    this.cacheHub();
  }

  get settings() {
    return this.settingsManager;
  }

  async fetchBlockWords() {
    const fromCache = await this.cache.smembers(this.blockWordsKey);
    if (fromCache.length > 0) {
      return fromCache.map((c) => JSON.parse(c)) as BlockWord[];
    }

    const blockWords = await db.blockWord.findMany({ where: { hubId: this.hub.id } });
    await this.storeInCache(this.blockWordsKey, blockWords);

    return blockWords;
  }

  async fetchInvites() {
    const invites = await db.hubInvite.findMany({ where: { hubId: this.hub.id } });
    return invites;
  }

  async fetchLogConfig() {
    if (!this.logManager) this.logManager = await HubLogManager.create(this.hub.id);
    return this.logManager;
  }

  async fetchConnections() {
    return await getHubConnections(this.hub.id);
  }

  isOwner(userId: string) {
    return this.data.ownerId === userId;
  }

  private async storeInCache(key: string, data: BlockWord[] | HubModerator[]) {
    const multi = this.cache.multi();
    multi.del(key);
    data.forEach(async (bw) => multi.sadd(key, JSON.stringify(bw)));
    multi.expire(key, 60 * 60 * 24); //
    await multi.exec();
  }

  async isManager(userId: string) {
    return this.modManager.checkStatus(userId, ['MANAGER', 'OWNER']);
  }

  async isMod(userId: string) {
    return this.modManager.checkStatus(userId);
  }
}
