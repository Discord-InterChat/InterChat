import BaseBlacklistManager from '#main/core/BaseBlacklistManager.js';
import { getCachedData } from '#main/utils/cache/cacheUtils.js';
import { RedisKeys } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { logUserUnblacklist } from '#main/utils/HubLogger/ModLogs.js';
import { supportedLocaleCodes } from '#main/utils/Locale.js';
import { Prisma, userData } from '@prisma/client';
import { Snowflake, User } from 'discord.js';

export default class UserDbManager extends BaseBlacklistManager<userData> {
  protected modelName = 'userData' as const;

  private serializeBlacklists(blacklist: ConvertDatesToString<userData>): userData {
    return {
      ...blacklist,
      lastVoted: blacklist.lastVoted ? new Date(blacklist.lastVoted) : null,
      blacklistedFrom: blacklist.blacklistedFrom.map((b) => ({
        ...b,
        expires: b.expires ? new Date(b.expires) : null,
      })),
    };
  }

  async getUser(id: Snowflake): Promise<userData | null> {
    const results = await getCachedData(
      `${RedisKeys.userData}:${id}`,
      async () => await db.userData.findFirst({ where: { id } }),
    );

    if (!results.data) return null;
    if (!results.fromCache) this.addToCache(results.data);

    return this.serializeBlacklists(results.data);
  }

  async getUserLocale(userOrId: string | userData | null | undefined) {
    const dbUser = typeof userOrId === 'string' ? await this.getUser(userOrId) : userOrId;
    return (dbUser?.locale as supportedLocaleCodes | null | undefined) ?? 'en';
  }

  async createUser(data: Prisma.userDataCreateInput) {
    const createdUser = await db.userData.create({ data });
    await this.addToCache(createdUser);
    return createdUser;
  }

  async updateUser(id: Snowflake, data: Prisma.userDataUpdateInput) {
    const updatedUser = await db.userData.update({ where: { id }, data });
    await this.addToCache(updatedUser);
    return updatedUser;
  }

  async userVotedToday(id: Snowflake): Promise<boolean> {
    const user = await this.getUser(id);
    const twenty4HoursAgo = new Date(Date.now() - 60 * 60 * 24 * 1000);
    return Boolean(user?.lastVoted && new Date(user.lastVoted) >= twenty4HoursAgo);
  }

  public override async fetchBlacklist(hubId: string, id: string) {
    const blacklist = await this.getUser(id);
    return blacklist?.blacklistedFrom.find((h) => h.hubId === hubId) ? blacklist : null;
  }

  public override async logUnblacklist(
    hubId: string,
    id: string,
    { mod, reason }: { mod: User; reason?: string },
  ) {
    await logUserUnblacklist(this.client, hubId, { id, mod, reason });
  }

  /**
   * Add a user to the blacklist.
   * @param hubId The ID of the hub to add the blacklist to.
   * @param userId The ID of the user to blacklist.
   * @param reason The reason for the blacklist.
   * @param expires The date or milliseconds after which the blacklist will expire.
   * @returns The created blacklist.
   */
  async addBlacklist(
    user: { id: Snowflake; name: string },
    hubId: string,
    {
      reason,
      moderatorId,
      expires: _expires,
    }: { reason: string; moderatorId: Snowflake; expires: Date | null },
  ) {
    const expires = typeof _expires === 'number' ? new Date(Date.now() + _expires) : _expires;
    const dbUser = await this.getUser(user.id);

    // if already blacklisted, override it
    const hubs = dbUser?.blacklistedFrom.filter((b) => b.hubId !== hubId) || [];
    hubs.push({ expires, reason, hubId, moderatorId });

    const updatedUser = await db.userData.upsert({
      where: { id: user.id },
      update: { username: user.name, blacklistedFrom: { set: hubs } },
      create: { id: user.id, username: user.name, blacklistedFrom: hubs },
    });

    this.addToCache(updatedUser, expires?.getSeconds());
    return updatedUser;
  }

  /**
   * Remove a user or server from the blacklist.
   * @param hubId The hub ID to remove the blacklist from.
   * @param userOrServerId The user or server ID to remove from the blacklist.
   * @returns The updated blacklist.
   */
  async removeBlacklist(hubId: string, userId: Snowflake) {
    const notInBlacklist = this.fetchBlacklist(hubId, userId);
    if (!notInBlacklist) return null;

    const user = await db.userData.update({
      where: { id: userId },
      data: { blacklistedFrom: { deleteMany: { where: { hubId } } } },
    });

    this.addToCache(user);
    return user;
  }

  /**
   * Notify a user or server that they have been blacklisted.
   * @param type The type of blacklist to notify. (user/server)
   * @param id The user or server ID to notify.
   * @param hubId The hub ID to notify.
   * @param expires The date after which the blacklist expires.
   * @param reason The reason for the blacklist.
   */
  async sendNotification(opts: {
    target: User;
    hubId: string;
    expires: Date | null;
    reason?: string;
  }): Promise<void> {
    const hub = await db.hubs.findUnique({ where: { id: opts.hubId } });
    // TODO: Make this method also handle misc notifications, not only blacklists
    const embed = this.buildNotifEmbed(
      `You have been blacklisted from talking in hub **${hub?.name}**`,
      { expires: opts.expires, reason: opts.reason },
    );

    await opts.target.send({ embeds: [embed] }).catch(() => null);
  }
}
