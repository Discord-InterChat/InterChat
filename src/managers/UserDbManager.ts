import db from '../utils/Db.js';
import BaseBlacklistManager from '../core/BaseBlacklistManager.js';
import { Prisma, userData } from '@prisma/client';
import { Snowflake, User } from 'discord.js';
import { logUserUnblacklist } from '../utils/HubLogger/ModLogs.js';

export default class UserDbManager extends BaseBlacklistManager<userData> {
  protected modelName: Prisma.ModelName = 'userData';

  protected override async fetchEntityFromDb(hubId: string, id: string) {
    return await db.userData.findFirst({ where: { id, blacklistedFrom: { some: { hubId } } } });
  }
  protected override async fetchExpiringEntities() {
    const currentTime = new Date();
    const twelveHoursLater = new Date(currentTime.getTime() + 12 * 60 * 60 * 1000);

    return await db.userData.findMany({
      where: {
        blacklistedFrom: { some: { expires: { lte: twelveHoursLater } } },
      },
    });
  }

  public override async logUnblacklist(
    hubId: string,
    userId: string,
    { mod, reason }: { mod: User; reason?: string },
  ) {
    await logUserUnblacklist(this.client, hubId, { userId, mod, reason });
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
      expires,
    }: { reason: string; moderatorId: Snowflake; expires: Date | null },
  ) {
    if (typeof expires === 'number') expires = new Date(Date.now() + expires);

    const dbUser = await db.userData.findFirst({ where: { id: user.id } });

    const hubs = dbUser?.blacklistedFrom.filter((i) => i.hubId !== hubId) || [];
    hubs?.push({ expires: expires ?? null, reason, hubId, moderatorId });

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
    const embed = this.buildNotifEmbed(
      `You have been blacklisted from talking in hub **${hub?.name}**`,
      { expires: opts.expires, reason: opts.reason },
    );

    await opts.target.send({ embeds: [embed] }).catch(() => null);
  }
}
