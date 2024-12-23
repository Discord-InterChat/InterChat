import ConnectionManager from '#main/managers/ConnectionManager.js';
import HubManager from '#main/managers/HubManager.js';
import { cacheHubConnection, convertToConnectedList } from '#main/utils/ConnectedListUtils.js';
import { RedisKeys } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import Logger from '#main/utils/Logger.js';
import getRedis from '#main/utils/Redis.js';
import { Connection, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import isEmpty from 'lodash/isEmpty.js';

export default class HubConnectionsManager {
  private hub: HubManager;
  private redis: Redis;
  private readonly key;

  constructor(hubManager: HubManager, redis?: Redis) {
    this.hub = hubManager;
    this.redis = redis ?? getRedis();
    this.key = `${RedisKeys.Hub}:${this.hub.id}:connections`;
  }

  async toArray() {
    const cached = await this.redis.hgetall(this.key);

    if (isEmpty(cached) === false) {
      const cachedData = Object.values(cached).map((c) => convertToConnectedList(JSON.parse(c)));
      return cachedData.map((c) => new ConnectionManager(c));
    }

    const fromDb = await db.connection.findMany({ where: { hubId: this.hub.id } });
    const keyValuePairs = fromDb.flatMap((c) => [c.channelId, JSON.stringify(c)]);

    if (keyValuePairs.length === 0) return [];

    Logger.debug(`Caching ${fromDb.length} connections for hub ${this.hub.id}`);

    await this.redis.hset(this.key, keyValuePairs);
    await this.redis.expire(this.key, 10 * 60 * 1000); // 10 minutes

    Logger.debug(`Cached ${fromDb.length} connections for hub ${this.hub.id}`);

    return fromDb.map((c) => new ConnectionManager(c));
  }

  async get(channelId: string) {
    const rawConnection = await this.redis.hget(this.key, channelId);

    if (!rawConnection) {
      const connection = await db.connection.findUnique({ where: { channelId } });
      if (!connection) return null;
      return await this.set(connection);
    }

    const connection = convertToConnectedList(JSON.parse(rawConnection));
    return new ConnectionManager(connection);
  }

  async set(data: Connection) {
    cacheHubConnection(data);
    return new ConnectionManager(data);
  }

  async create(data: Prisma.ConnectionCreateInput) {
    const existing = await this.get(data.channelId);
    if (existing) return null;

    const created = await db.connection.create({ data });
    await this.redis.hset(this.key, created.channelId, JSON.stringify(created));
    return new ConnectionManager(created);
  }

  async delete(channelId: string) {
    const connection = await this.get(channelId);
    if (!connection) return null;

    await connection.disconnect();
    return connection;
  }
}
