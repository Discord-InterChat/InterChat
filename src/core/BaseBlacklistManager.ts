import { colors, emojis } from '#main/utils/Constants.js';
import { getAllDocuments, serializeCache } from '#main/utils/db/cacheUtils.js';
import { hubBlacklist, Prisma } from '@prisma/client';
import { EmbedBuilder, Snowflake, User } from 'discord.js';
import Factory from '#main/core/Factory.js';

interface BlacklistEntity {
  id: string;
  blacklistedFrom: hubBlacklist[];
}

export default abstract class BaseBlacklistManager<T extends BlacklistEntity> extends Factory {
  protected abstract modelName: Prisma.ModelName;

  public abstract fetchBlacklist(hubId: string, entityId: string): Promise<T | null>;
  public abstract logUnblacklist(
    hubId: string,
    id: string,
    opts: { mod: User; reason?: string },
  ): Promise<void>;

  public abstract sendNotification(opts: {
    target: { id: Snowflake };
    hubId: string;
    expires: Date | null;
    reason?: string;
  }): Promise<void>;
  public abstract removeBlacklist(hubId: string, id: string): Promise<T | null>;
  public abstract addBlacklist(
    entity: { id: Snowflake; name: string },
    hubId: string,
    {
      reason,
      moderatorId,
      expires,
    }: { reason: string; moderatorId: Snowflake; expires: Date | null },
  ): Promise<T>;

  public async getAllBlacklists() {
    return serializeCache<T>(await getAllDocuments(`${this.modelName}:*`));
  }

  protected buildNotifEmbed(description: string, opts: { expires: Date | null; reason?: string }) {
    const expireString = opts.expires
      ? `<t:${Math.round(opts.expires.getTime() / 1000)}:R>`
      : 'Never';

    return new EmbedBuilder()
      .setTitle(`${emojis.blobFastBan} Blacklist Notification`)
      .setDescription(description)
      .setColor(colors.interchatBlue)
      .setFields(
        { name: 'Reason', value: opts.reason ?? 'No reason provided.', inline: true },
        { name: 'Expires', value: expireString, inline: true },
      );
  }
}
