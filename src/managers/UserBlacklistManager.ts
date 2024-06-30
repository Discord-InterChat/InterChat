import db from '../utils/Db.js';
import Scheduler from '../services/SchedulerService.js';
import { emojis, colors } from '../utils/Constants.js';
import { logUserUnblacklist } from '../utils/HubLogger/ModLogs.js';
import { userData } from '@prisma/client';
import { Collection, Snowflake, EmbedBuilder, User } from 'discord.js';
import SuperClient from '../core/Client.js';
import { handleError } from '../utils/Utils.js';

export default class UserBlacklistManager {
  private scheduler: Scheduler;
  private cache: Collection<string, userData>;

  constructor() {
    this.scheduler = new Scheduler;
    this.cache = new Collection();

    this.scheduler.addRecurringTask('unblacklistUsers', 10_000, () => this.removeStaleBlacklists());
    this.scheduler.addRecurringTask('cacheUserBlacklists', 60 * 60 * 1000, () => this.cacheSoonExpiring());
  }

  private async cacheSoonExpiring() {
    const currentTime = new Date();
    const twelveHoursLater = new Date(currentTime.getTime() + 12 * 60 * 60 * 1000);

    const users = await db.userData.findMany({
      where: {
        blacklistedFrom: {
          some: {
            expires: { gte: currentTime, lte: twelveHoursLater },
          },
        },
      },
    });

    users.forEach((user) => this.cache.set(user.userId, user));
  }

  private removeStaleBlacklists() {
    const filter = ({ expires }: { expires: Date | null }) => expires && expires <= new Date();
    const users = this.cache.filter((user) => user.blacklistedFrom.some(filter));
    if (users?.size === 0) return;

    users.forEach((user) => {
      const blacklists = user.blacklistedFrom.filter(filter);
      if (!blacklists) return;

      blacklists.forEach(async ({ hubId }) => {
        const client = SuperClient.instance;
        if (client?.user) {
          await logUserUnblacklist(client, hubId, {
            userId: user.userId,
            mod: client.user,
            reason: 'Blacklist duration expired.',
          }).catch(handleError);
        }

        await this.removeBlacklist(hubId, user.userId);
        this.cache.delete(user.id);
      });
    });
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
    hubId: string,
    user: { id: Snowflake; username: string },
    reason: string,
    moderatorId: Snowflake,
    expires?: Date | number,
  ) {
    if (typeof expires === 'number') expires = new Date(Date.now() + expires);

    const dbUser = await db.userData.findFirst({ where: { userId: user.id } });

    const hubs = dbUser?.blacklistedFrom.filter((i) => i.hubId !== hubId) || [];
    hubs?.push({ expires: expires ?? null, reason, hubId, moderatorId });

    const updatedUser = await db.userData.upsert({
      where: {
        userId: user.id,
      },
      update: {
        username: user.username,
        blacklistedFrom: { set: hubs },
      },
      create: {
        userId: user.id,
        username: user.username,
        blacklistedFrom: hubs,
      },
    });

    this.cache.set(updatedUser.userId, updatedUser);

    return updatedUser;
  }

  /**
   * Remove a user or server from the blacklist.
   * @param hubId The hub ID to remove the blacklist from.
   * @param userOrServerId The user or server ID to remove from the blacklist.
   * @returns The updated blacklist.
   */
  async removeBlacklist(hubId: string, userId: Snowflake) {
    this.scheduler.stopTask(`blacklist_user::${userId}`);
    const where = { userId, blacklistedFrom: { some: { hubId } } };
    const notInBlacklist = await db.userData.findFirst({ where });
    if (!notInBlacklist) return null;

    const deletedRes = await db.userData.update({
      where,
      data: { blacklistedFrom: { deleteMany: { where: { hubId } } } },
    });

    this.cache.delete(deletedRes.userId);

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
  async notifyUser(
    user: User,
    opts: {
      hubId: string;
      expires?: Date;
      reason?: string;
    },
  ): Promise<void> {
    const hub = await db.hubs.findUnique({ where: { id: opts.hubId } });
    const expireString = opts.expires
      ? `<t:${Math.round(opts.expires.getTime() / 1000)}:R>`
      : 'Never';

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.blobFastBan} Blacklist Notification`)
      .setDescription(`You have been blacklisted from talking in hub **${hub?.name}**.`)
      .setColor(colors.interchatBlue)
      .setFields(
        { name: 'Reason', value: opts.reason ?? 'No reason provided.', inline: true },
        { name: 'Expires', value: expireString, inline: true },
      );

    await user.send({ embeds: [embed] }).catch(() => null);
  }

  /**
   * Fetch a user blacklist from the database.
   * @param hubId The hub ID to fetch the blacklist from.
   * @param userId The ID of the blacklisted user.
   */
  async fetchBlacklist(hubId: string, userId: string) {
    const userBlacklisted =
      this.cache.find(
        (v) => v.blacklistedFrom.some((h) => h.hubId === hubId) && v.userId === userId,
      ) ??
      (await db.userData.findFirst({ where: { userId, blacklistedFrom: { some: { hubId } } } }));

    return userBlacklisted;
  }
}
