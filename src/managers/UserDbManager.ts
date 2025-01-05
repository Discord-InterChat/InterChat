import type { Prisma, UserData } from '@prisma/client';
import type { Snowflake } from 'discord.js';
import { CacheManager } from '#main/managers/CacheManager.js';
import getRedis from '#main/utils/Redis.js';
import type { ConvertDatesToString } from '#types/Utils.d.ts';
import { RedisKeys } from '#utils/Constants.js';
import db from '#utils/Db.js';
import type { supportedLocaleCodes } from '#utils/Locale.js';

export default class UserDbManager {
  private readonly cacheManager: CacheManager;
  private readonly VOTE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.cacheManager = new CacheManager(getRedis(), { prefix: RedisKeys.userData });
  }

  private serializeUserDates(user: ConvertDatesToString<UserData>): UserData {
    const dates = {
      lastMessageAt: new Date(user.lastMessageAt),
      updatedAt: new Date(user.updatedAt),
      lastVoted: user.lastVoted ? new Date(user.lastVoted) : null,
    };
    return { ...user, ...dates };
  }

  public async getUser(id: Snowflake): Promise<UserData | null> {
    const result = await this.cacheManager.get<UserData>(
      id,
      async () => await db.userData.findFirst({ where: { id } }),
    );

    return result ? this.serializeUserDates(result) : null;
  }

  public async createUser(data: Prisma.UserDataCreateInput): Promise<UserData> {
    const user = await db.userData.create({ data });
    await this.cacheUser(user);
    return user;
  }

  public async updateUser(id: Snowflake, data: Prisma.UserDataUpdateInput): Promise<UserData> {
    const user = await db.userData.update({ where: { id }, data });
    await this.cacheUser(user);
    return user;
  }

  public async upsertUser(
    id: Snowflake,
    data: Omit<Prisma.UserDataUpsertArgs['create'], 'id'>,
  ): Promise<UserData> {
    const user = await db.userData.upsert({
      where: { id },
      create: { ...data, id },
      update: data,
    });
    await this.cacheUser(user);
    return user;
  }

  public async getUserLocale(
    userOrId: string | UserData | null | undefined,
  ): Promise<supportedLocaleCodes> {
    const user = typeof userOrId === 'string' ? await this.getUser(userOrId) : userOrId;
    return (user?.locale as supportedLocaleCodes) ?? 'en';
  }

  public async userVotedToday(id: Snowflake): Promise<boolean> {
    const user = await this.getUser(id);
    if (!user?.lastVoted) return false;

    const lastVoteTime = new Date(user.lastVoted).getTime();
    const timeSinceVote = Date.now() - lastVoteTime;
    return timeSinceVote < this.VOTE_COOLDOWN_MS;
  }

  // Moderation methods
  public async ban(id: string, reason: string, username?: string): Promise<void> {
    await this.upsertUser(id, {
      username,
      voteCount: 0,
      banReason: reason,
    });
  }

  public async unban(id: string, username?: string): Promise<void> {
    await this.upsertUser(id, {
      username,
      voteCount: 0,
      banReason: null,
    });
  }

  private async cacheUser(user: UserData, expirySecs?: number): Promise<void> {
    await this.cacheManager.set(user.id, user, expirySecs);
  }
}
