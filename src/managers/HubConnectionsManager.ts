import type { Connection, Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import isEmpty from 'lodash/isEmpty.js';
import ConnectionManager from '#main/managers/ConnectionManager.js';
import type HubManager from '#main/managers/HubManager.js';
import { cacheHubConnection, convertToConnectedList } from '#main/utils/ConnectedListUtils.js';
import { RedisKeys } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import Logger from '#main/utils/Logger.js';
import getRedis from '#main/utils/Redis.js';

interface CacheConfig {
  expirationMs: number;
}

export default class HubConnectionsManager {
  private readonly cacheKey: string;
  private readonly cacheConfig: CacheConfig = {
    expirationMs: 10 * 60 * 1000, // 10 minutes
  };

  constructor(
    private readonly hub: HubManager,
    private readonly redis: Redis = getRedis(),
  ) {
    this.cacheKey = this.buildCacheKey(hub.id);
  }

  async fetch(channelId: string): Promise<ConnectionManager | null>;
  async fetch(): Promise<ConnectionManager[]>;
  async fetch(channelId?: string): Promise<ConnectionManager[] | ConnectionManager | null> {
    if (channelId) {
      const cachedConnection = await this.getCachedConnection(channelId);
      if (cachedConnection) {
        return new ConnectionManager(cachedConnection);
      }

      return this.fetchAndCacheConnection(channelId);
    }
    const cachedConnections = await this.getCachedConnections();
    if (cachedConnections.length > 0) {
      return this.createManagersFromConnections(cachedConnections);
    }

    return this.fetchAndCacheConnections();
  }

  async createConnection(data: Prisma.ConnectionCreateInput): Promise<ConnectionManager | null> {
    const existingConnection = await this.fetch(data.channelId);
    if (existingConnection) {
      return null;
    }

    const connection = await db.connection.create({ data });
    await this.cacheConnection(connection);
    return new ConnectionManager(connection);
  }

  async deleteConnection(channelId: string): Promise<ConnectionManager | null> {
    const connection = await this.fetch(channelId);
    if (!connection) {
      return null;
    }

    await connection.disconnect();
    return connection;
  }

  async setConnection(connection: Connection): Promise<ConnectionManager> {
    await this.cacheConnection(connection);
    return new ConnectionManager(connection);
  }

  // Private helper methods
  private buildCacheKey(hubId: string): string {
    return `${RedisKeys.Hub}:${hubId}:connections`;
  }

  private async getCachedConnections(): Promise<Connection[]> {
    const cached = await this.redis.hgetall(this.cacheKey);
    if (isEmpty(cached)) {
      return [];
    }

    return Object.values(cached).map((conn) => convertToConnectedList(JSON.parse(conn)));
  }

  private async fetchAndCacheConnections(): Promise<ConnectionManager[]> {
    const connections = await db.connection.findMany({
      where: { hubId: this.hub.id },
    });

    if (connections.length === 0) {
      return [];
    }

    await this.cacheConnections(connections);
    return this.createManagersFromConnections(connections);
  }

  private async getCachedConnection(channelId: string): Promise<Connection | null> {
    const rawConnection = await this.redis.hget(this.cacheKey, channelId);
    if (!rawConnection) {
      return null;
    }

    return convertToConnectedList(JSON.parse(rawConnection));
  }

  private async fetchAndCacheConnection(channelId: string): Promise<ConnectionManager | null> {
    const connection = await db.connection.findUnique({
      where: { channelId },
    });

    if (!connection) {
      return null;
    }

    return this.setConnection(connection);
  }

  private async cacheConnections(connections: Connection[]): Promise<void> {
    Logger.debug(`Caching ${connections.length} connections for hub ${this.hub.id}`);

    const keyValuePairs = connections.flatMap((conn) => [conn.channelId, JSON.stringify(conn)]);

    await this.redis.hset(this.cacheKey, keyValuePairs);
    await this.redis.expire(this.cacheKey, this.cacheConfig.expirationMs);

    Logger.debug(`Cached ${connections.length} connections for hub ${this.hub.id}`);
  }

  private async cacheConnection(connection: Connection): Promise<void> {
    cacheHubConnection(connection);
  }

  private createManagersFromConnections(connections: Connection[]): ConnectionManager[] {
    return connections.map((conn) => new ConnectionManager(conn));
  }
}
