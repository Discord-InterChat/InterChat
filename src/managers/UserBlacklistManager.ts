import db from '../utils/Db.js';
import { emojis, colors } from '../utils/Constants.js';
import { logUserUnblacklist } from '../utils/HubLogger/ModLogs.js';
import { userData } from '@prisma/client';
import { Snowflake, EmbedBuilder, User } from 'discord.js';
import SuperClient from '../core/Client.js';
import { handleError } from '../utils/Utils.js';
import BaseBlacklistManager from '../core/BaseBlacklistManager.js';

export default class UserBlacklistManager extends BaseBlacklistManager<userData> {
  protected override async fetchEntityFromDb(hubId: string, id: string) {
    return await db.userData.findFirst({ where: { id, blacklistedFrom: { some: { hubId } } } });
  }
  protected override async fetchExpiringEntities() {
    const currentTime = new Date();
    const twelveHoursLater = new Date(currentTime.getTime() + 12 * 60 * 60 * 1000);

    return await db.userData.findMany({
      where: {
        blacklistedFrom: { some: { expires: { gte: currentTime, lte: twelveHoursLater } } },
      },
    });
  }

  protected override async logUnblacklist(client: SuperClient, hubId: string, userId: string) {
    if (!client?.user) return;

    await logUserUnblacklist(client, hubId, {
      userId,
      mod: client.user,
      reason: 'Blacklist duration expired.',
    }).catch(handleError);
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
    { reason, moderatorId, expires }: { reason: string; moderatorId: Snowflake; expires?: Date },
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

    this.cache.set(updatedUser.id, updatedUser);

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

    this.cache.delete(deletedRes.id);

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
}
