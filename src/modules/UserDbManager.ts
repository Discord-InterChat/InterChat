import { RedisKeys } from '#main/config/Constants.js';
import { cacheData, getCachedData } from '#main/utils/cache/cacheUtils.js';
import db from '#main/utils/Db.js';
import { supportedLocaleCodes } from '#main/utils/Locale.js';
import { Prisma, UserData } from '@prisma/client';
import { Snowflake } from 'discord.js';

export default class UserDbManager {
  private async addToCache(entity: ConvertDatesToString<UserData> | UserData, expirySecs?: number) {
    await cacheData(`${RedisKeys.userData}:${entity.id}`, JSON.stringify(entity), expirySecs);
  }

  private serializeUserDates(user: ConvertDatesToString<UserData>): UserData {
    return {
      ...user,
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

  async userVotedToday(id: Snowflake): Promise<boolean> {
    const user = await this.getUser(id);
    const twenty4HoursAgo = new Date(Date.now() - 60 * 60 * 24 * 1000);
    return Boolean(user?.lastVoted && new Date(user.lastVoted) >= twenty4HoursAgo);
  }

  async ban(id: string, reason: string, username?: string) {
    return await db.userData.upsert({
      where: { id },
      create: {
        id,
        username,
        viewedNetworkWelcome: false,
        voteCount: 0,
        banMeta: { reason },
      },
      update: { banMeta: { reason }, username },
    });
  }

  async unban(id: string, username?: string) {
    return await db.userData.upsert({
      where: { id },
      create: {
        id,
        username,
        viewedNetworkWelcome: false,
        voteCount: 0,
        banMeta: { set: null },
      },
      update: { banMeta: { set: null }, username },
    });
  }
}
