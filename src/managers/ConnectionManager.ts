import { HubService } from '#main/services/HubService.js';
import { cacheHubConnection } from '#main/utils/ConnectedListUtils.js';
import { RedisKeys } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import getRedis from '#main/utils/Redis.js';
import { Connection, Prisma } from '@prisma/client';
import { HexColorString } from 'discord.js';

export default class ConnectionManager {
  private connection: Connection;
  private readonly cache = getRedis();
  private readonly key: string;
  readonly hubService = new HubService();

  constructor(connection: Connection) {
    this.connection = connection;
    this.key = `${RedisKeys.Hub}:${connection.hubId}:connections`;
  }

  get id() {
    return this.connection.id;
  }

  get hubId() {
    return this.connection.hubId;
  }

  get data() {
    return this.connection;
  }

  async fetchHub() {
    return await this.hubService.fetchHub(this.hubId);
  }

  private async refreshCache(deleteConnection = false) {
    if (deleteConnection) {
      await this.cache.hdel(this.key, this.connection.channelId);
      await this.cache.del(`${RedisKeys.connectionHubId}:${this.connection.channelId}`);
      return;
    }
    cacheHubConnection(this.connection);
  }

  private async updateConnection(data: Prisma.ConnectionUpdateInput) {
    this.connection = await db.connection.update({
      where: { id: this.connection.id },
      data,
    });

    await this.refreshCache();
  }

  async pause() {
    const exists = await this.cache.hget(this.key, this.connection.channelId);
    if (!exists) return;

    await this.updateConnection({ connected: false });
  }
  async resume() {
    const exists = await this.cache.hget(this.key, this.connection.channelId);
    if (!exists) return;

    await this.updateConnection({ connected: true });
  }
  async disconnect() {
    const exists = await this.cache.hget(this.key, this.connection.channelId);
    if (!exists) return;

    await db.connection.delete({ where: { id: this.connection.id } });
    await this.refreshCache(true);
  }
  async setInvite(invite: string) {
    const exists = await this.cache.hget(this.key, this.connection.channelId);
    if (!exists) return;

    await this.updateConnection({ invite });
  }
  async setEmbedColor(embedColor: HexColorString) {
    const exists = await this.cache.hget(this.key, this.connection.channelId);
    if (!exists) return;

    await this.updateConnection({ embedColor });
  }
  async toggleCompactMode() {
    const exists = await this.cache.hget(this.key, this.connection.channelId);
    if (!exists) return;

    await this.updateConnection({ compact: !this.connection.compact });
  }

  async setCompactMode(compact: boolean) {
    const exists = await this.cache.hget(this.key, this.connection.channelId);
    if (!exists) return;

    await this.updateConnection({ compact });
  }
  async setProfanityFilter(profFilter: boolean) {
    const exists = await this.cache.hget(this.key, this.connection.channelId);
    if (!exists) return;

    await this.updateConnection({ profFilter });
  }
}
