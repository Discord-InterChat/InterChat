import type { Connection, Prisma } from '@prisma/client';
import type { HexColorString } from 'discord.js';
import { HubService } from '#main/services/HubService.js';
import { cacheHubConnection } from '#main/utils/ConnectedListUtils.js';
import { RedisKeys } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import getRedis from '#main/utils/Redis.js';

export default class ConnectionManager {
  private readonly cache = getRedis();
  private readonly hubService = new HubService();
  private readonly cacheKey: string;

  constructor(private connection: Connection) {
    this.cacheKey = this.buildCacheKey(connection.hubId);
  }

  get id(): string {
    return this.connection.id;
  }

  get hubId(): string {
    return this.connection.hubId;
  }

  get data(): Connection {
    return this.connection;
  }

  get connected(): boolean {
    return this.connection.connected;
  }

  get channelId(): string {
    return this.connection.channelId;
  }

  // Public methods
  async fetchHub() {
    return this.hubService.fetchHub(this.hubId);
  }

  async pause(): Promise<void> {
    await this.updateConnectionIfExists({ connected: false });
  }

  async resume(): Promise<void> {
    await this.updateConnectionIfExists({ connected: true });
  }

  async disconnect(): Promise<void> {
    if (!(await this.connectionExists())) {
      return;
    }

    await db.connection.delete({
      where: { id: this.connection.id },
    });
    await this.clearCache();
  }

  async setInvite(invite: string): Promise<void> {
    await this.updateConnectionIfExists({ invite });
  }

  async setEmbedColor(embedColor: HexColorString): Promise<void> {
    await this.updateConnectionIfExists({ embedColor });
  }

  async setCompactMode(compact: boolean): Promise<void> {
    await this.updateConnectionIfExists({ compact });
  }

  async toggleCompactMode(): Promise<void> {
    await this.updateConnectionIfExists({
      compact: !this.connection.compact,
    });
  }

  async setProfanityFilter(profFilter: boolean): Promise<void> {
    await this.updateConnectionIfExists({ profFilter });
  }

  // Private helper methods
  private buildCacheKey(hubId: string): string {
    return `${RedisKeys.Hub}:${hubId}:connections`;
  }

  private async connectionExists(): Promise<boolean> {
    return Boolean(await this.cache.hget(this.cacheKey, this.connection.channelId));
  }

  private async updateConnectionIfExists(data: Prisma.ConnectionUpdateInput): Promise<void> {
    if (!(await this.connectionExists())) {
      return;
    }
    await this.updateConnection(data);
  }

  private async updateConnection(data: Prisma.ConnectionUpdateInput): Promise<void> {
    this.connection = await db.connection.update({
      where: { id: this.connection.id },
      data,
    });
    await this.updateCache();
  }

  private async updateCache(): Promise<void> {
    cacheHubConnection(this.connection);
  }

  private async clearCache(): Promise<void> {
    await Promise.all([
      this.cache.hdel(this.cacheKey, this.connection.channelId),
      this.cache.del(`${RedisKeys.connectionHubId}:${this.connection.channelId}`),
    ]);
  }
}
