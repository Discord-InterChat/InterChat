import { RedisKeys } from '#utils/Constants.js';
import { cacheData, getCachedData } from '#utils/CacheUtils.js';
import db from '#utils/Db.js';
import { supportedLocaleCodes } from '#utils/Locale.js';
import { Prisma, UserData } from '@prisma/client';
import { Snowflake } from 'discord.js';
import type { ConvertDatesToString } from '#types/Utils.d.ts';

export default class UserDbManager {
  private async addToCache(entity: ConvertDatesToString<UserData> | UserData, expirySecs?: number) {
    await cacheData(`${RedisKeys.userData}:${entity.id}`, JSON.stringify(entity), expirySecs);
  }

  private serializeUserDates(user: ConvertDatesToString<UserData>): UserData {
    return {
      ...user,
      lastMessageAt: new Date(user.lastMessageAt),
      updatedAt: new Date(user.updatedAt),
      lastVoted: user.lastVoted ? new Date(user.lastVoted) : null,
    };
  }

  async getUser(id: Snowflake): Promise<UserData | null> {
    const results = await getCachedData(
      `${RedisKeys.userData}:${id}`,
      async () => await db.userData.findFirst({ where: { id } }),
    );

    if (!results.data) return null;
    if (!results.fromCache) this.addToCache(results.data);

    return this.serializeUserDates(results.data);
  }

  async getUserLocale(userOrId: string | UserData | null | undefined) {
    const dbUser = typeof userOrId === 'string' ? await this.getUser(userOrId) : userOrId;
    return (dbUser?.locale as supportedLocaleCodes | null | undefined) ?? 'en';
  }

  async createUser(data: Prisma.UserDataCreateInput) {
    const createdUser = await db.userData.create({ data });
    await this.addToCache(createdUser);
    return createdUser;
  }

  async updateUser(id: Snowflake, data: Prisma.UserDataUpdateInput) {
    const updatedUser = await db.userData.update({ where: { id }, data });
    await this.addToCache(updatedUser);
    return updatedUser;
  }

  async upsertUser(id: Snowflake, data: Omit<Prisma.UserDataUpsertArgs['create'], 'id'>) {
    const upsertedUser = await db.userData.upsert({
      where: { id },
      create: { ...data, id },
      update: data,
    });
    await this.addToCache(upsertedUser);
    return upsertedUser;
  }

  async userVotedToday(id: Snowflake): Promise<boolean> {
    const user = await this.getUser(id);
    const twenty4HoursAgo = new Date(Date.now() - 60 * 60 * 24 * 1000);
    return Boolean(user?.lastVoted && new Date(user.lastVoted) >= twenty4HoursAgo);
  }

  async ban(id: string, reason: string, username?: string) {
    const user = await this.upsertUser(id, {
      username,
      voteCount: 0,
      banReason: reason,
    });

    await this.addToCache(user);
  }

  async unban(id: string, username?: string) {
    const user = await this.upsertUser(id, {
      username,
      voteCount: 0,
      banReason: null,
    });

    await this.addToCache(user);
  }
}
