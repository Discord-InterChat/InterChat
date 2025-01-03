import HubManager from '#main/managers/HubManager.js';
import { RedisKeys } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import getRedis from '#main/utils/Redis.js';
import { handleError } from '#main/utils/Utils.js';
import { HubModerator, Role } from '@prisma/client';
import { Collection } from 'discord.js';
import { Redis } from 'ioredis';
import isEmpty from 'lodash/isEmpty.js';

export default class HubModeratorManager {
  private readonly hub: HubManager;
  private readonly modsKey: string;
  private readonly cache: Redis;
  // 10 minutes
  private readonly expirationSeconds = 10 * 60 * 1000;

  constructor(hub: HubManager, cache: Redis = getRedis()) {
    this.hub = hub;
    this.cache = cache;
    this.modsKey = `${RedisKeys.Hub}:${hub.id}:moderators`;
  }

  private async storeInCache(mods: HubModerator[]) {
    if (!mods.length) return;

    await this.cache.hset(
      this.modsKey,
      mods.map((mod) => [mod.userId, JSON.stringify(mod)]).flat(),
    );
    await this.cache.expire(this.modsKey, this.expirationSeconds);
  }

  private async syncModeratorsCache(data: HubModerator) {
    try {
      if ((await this.cache.hlen(this.modsKey)) === 0) {
        await this.fetchAll();
      }
      else {
        await this.cache.hset(this.modsKey, data.userId, JSON.stringify(data));
        await this.cache.expire(this.modsKey, this.expirationSeconds);
      }
    }
    catch (e) {
      handleError(e);
    }
  }

  async add(userId: string, role: Role) {
    const data = await db.hubModerator.create({ data: { hubId: this.hub.id, userId, role } });
    this.syncModeratorsCache(data);
  }

  async remove(userId: string) {
    await db.hubModerator.delete({ where: { hubId_userId: { hubId: this.hub.id, userId } } });
    await this.cache.hdel(this.modsKey, userId);
    await this.cache.expire(this.modsKey, this.expirationSeconds);
  }

  async update(userId: string, role: Role) {
    const data = await db.hubModerator.update({
      where: { hubId_userId: { hubId: this.hub.id, userId } },
      data: { role },
    });

    this.syncModeratorsCache(data);
  }

  async fetchAll() {
    const fromCache = await this.cache.hgetall(this.modsKey);
    if (!isEmpty(fromCache)) {
      return new Collection(
        Object.entries(fromCache).map(([userId, mod]) => [userId, JSON.parse(mod) as HubModerator]),
      );
    }

    const mods = await db.hubModerator.findMany({ where: { hubId: this.hub.id } });
    await this.storeInCache(mods);

    return new Collection(mods.map((m) => [m.userId, m]));
  }

  async fetch(userId: string) {
    const fromCache = await this.cache.hget(this.modsKey, userId);
    if (fromCache) return JSON.parse(fromCache) as HubModerator;

    const mod = await db.hubModerator.findFirst({ where: { hubId: this.hub.id, userId } });
    if (mod) {
      this.cache.hlen(this.modsKey).then(async (len) => {
        if (len === 0) this.fetchAll();
        else await this.cache.hset(this.modsKey, userId, JSON.stringify(mod));
      });
    }

    return mod;
  }

  async checkStatus(userId: string, checkRoles?: Role[]) {
    if (this.hub.isOwner(userId)) return true;

    const mod = await this.fetch(userId);

    if (!mod) return false;
    if (!checkRoles?.length) return true;

    return checkRoles.includes(mod.role);
  }

  async removeAll() {
    await db.hubModerator.deleteMany({ where: { hubId: this.hub.id } });
    await this.cache.del(this.modsKey);
  }
}
