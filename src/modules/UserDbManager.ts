import db from '#main/utils/Db.js';
import BaseBlacklistManager from '#main/core/BaseBlacklistManager.js';
import { getCachedData } from '#main/utils/db/cacheUtils.js';
import { logUserUnblacklist } from '#main/utils/HubLogger/ModLogs.js';
import { supportedLocaleCodes } from '#main/utils/Locale.js';
import { Prisma, userData } from '@prisma/client';
import { Snowflake, User } from 'discord.js';

export default class UserDbManager extends BaseBlacklistManager<userData> {
  protected modelName: Prisma.ModelName = 'userData';

  async getUser(id: Snowflake) {
    return await getCachedData(
      `userData:${id}`,
      async () => await db.userData.findFirst({ where: { id } }),
    );
  }

  async getUserLocale(userOrId: string | userData | null | undefined) {
    const dbUser = typeof userOrId === 'string' ? await this.getUser(userOrId) : userOrId;
    return (dbUser?.locale as supportedLocaleCodes | null | undefined) ?? 'en';
  }

  async userVotedToday(id: Snowflake): Promise<boolean> {
    const user = await this.getUser(id);
    const twenty4HoursAgo = new Date(Date.now() - (60 * 60 * 24 * 1000));
    return Boolean(user?.lastVoted && user.lastVoted >= twenty4HoursAgo);
  }

  public override async fetchBlacklist(hubId: string, id: string) {
    const blacklist = await getCachedData(
      `${this.modelName}:${id}`,
      async () => await this.getUser(id),
    );

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

    const hubs = dbUser?.blacklistedFrom.filter((i) => i.hubId !== hubId) || [];
    hubs?.push({ expires, reason, hubId, moderatorId });

    const updatedUser = await db.userData.upsert({
      where: { id: user.id },
      update: { username: user.name, blacklistedFrom: { set: hubs } },
      create: { id: user.id, username: user.name, blacklistedFrom: hubs },
    });
    return updatedUser;
  }

  /**
   * Remove a user or server from the blacklist.
   * @param hubId The hub ID to remove the blacklist from.
   * @param userOrServerId The user or server ID to remove from the blacklist.
   * @returns The updated blacklist.
   */
  async removeBlacklist(hubId: string, userId: Snowflake) {
    const where = { id: userId, blacklistedFrom: { some: { hubId } } };
    const notInBlacklist = await db.userData.findFirst({ where });
    if (!notInBlacklist) return null;

    const deletedRes = await db.userData.update({
      where,
      data: { blacklistedFrom: { deleteMany: { where: { hubId } } } },
    });

    return deletedRes;
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
