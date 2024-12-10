import InfractionManager from '#main/managers/InfractionManager.js';
import UserDbManager from '#main/managers/UserDbManager.js';
import { HubService } from '#main/services/HubService.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import { sendLog } from '#main/utils/hub/logger/Default.js';
import { resolveEval } from '#main/utils/Utils.js';
import { Infraction, InfractionStatus, Prisma } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { Client, EmbedBuilder, User, type Snowflake } from 'discord.js';

export default class BlacklistManager {
  public readonly targetId: Snowflake;
  public readonly infractions;
  private readonly type: 'user' | 'server';
  private readonly userManager = new UserDbManager();

  constructor(type: 'user' | 'server', targetId: Snowflake) {
    this.type = type;
    this.targetId = targetId;
    this.infractions = new InfractionManager(type, targetId);
  }

  public async addBlacklist(opts: {
    hubId: string;
    reason: string;
    moderatorId: string;
    expiresAt: Date | null;
    serverName?: string;
  }): Promise<Infraction | null> {
    const blacklisted = await this.fetchBlacklist(opts.hubId);

    if (blacklisted) {
      return await this.infractions.updateInfraction(
        { hubId: opts.hubId, type: 'BLACKLIST', status: 'ACTIVE' },
        {
          updatedAt: new Date(),
          expiresAt: opts.expiresAt,
          reason: opts.reason,
          moderatorId: opts.moderatorId,
        },
      );
    }

    if (this.type === 'user' && !(await this.userManager.getUser(this.targetId))) {
      await this.userManager.createUser({ id: this.targetId }); // Create user if not found
    }

    return await this.infractions.addInfraction('BLACKLIST', opts);
  }

  public async removeBlacklist(
    hubId: string,
    status: Exclude<InfractionStatus, 'ACTIVE'> = 'REVOKED',
  ) {
    const exists = await this.fetchBlacklist(hubId);
    if (!exists) return null;

    return await this.infractions.revokeInfraction('BLACKLIST', hubId, status);
  }

  public async updateBlacklist(hubId: string, data: Prisma.InfractionUpdateInput) {
    const blacklisted = await this.fetchBlacklist(hubId);
    if (!blacklisted) return null;

    return await this.infractions.updateInfraction(
      { hubId, type: 'BLACKLIST', status: 'ACTIVE' },
      data,
    );
  }

  public async fetchBlacklist(hubId: string) {
    const blacklist = await this.infractions.fetchInfraction('BLACKLIST', hubId, 'ACTIVE');
    return blacklist;
  }
  /**
   * Logs the blacklisting of a user or server.
   * @param userOrServer - The user or server being blacklisted.
   * @param mod - The moderator performing the blacklisting.
   * @param reason - The reason for the blacklisting.
   * @param expires - The optional expiration date for the blacklisting.
   */
  async log(
    hubId: string,
    client: Client,
    opts: { mod: User; reason: string; expiresAt: Date | null },
  ) {
    const { mod, reason, expiresAt } = opts;

    const hub = await new HubService().fetchHub(hubId);
    const logConfig = await hub?.fetchLogConfig();

    if (!logConfig?.config.modLogs) return;

    let name;
    let iconURL;
    let type;
    let target;

    if (this.infractions.targetType === 'server') {
      target = resolveEval(
        await client.cluster.broadcastEval(
          (c, guildId) => {
            const guild = c.guilds.cache.get(guildId);
            if (!guild) return null;

            return { name: guild.name, iconURL: guild.iconURL() ?? undefined, id: guildId };
          },
          { context: this.targetId },
        ),
      );
      if (!target) return;

      name = target.name;
      iconURL = target.iconURL;
      type = 'Server';
    }
    else {
      target = await client.users.fetch(this.targetId);
      name = target.username;
      iconURL = target.displayAvatarURL();
      type = 'User';
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${type} ${name} blacklisted`, iconURL })
      .setDescription(
        stripIndents`
				${emojis.dotBlue} **${type}:** ${name} (${target.id})
				${emojis.dotBlue} **Moderator:** ${mod.username} (${mod.id})
				${emojis.dotBlue} **Hub:** ${hub?.data.name}
			`,
      )
      .addFields(
        { name: 'Reason', value: reason, inline: true },
        {
          name: 'Expires',
          value: expiresAt ? `<t:${Math.round(expiresAt.getTime() / 1000)}:R>` : 'Never.',
          inline: true,
        },
      )
      .setColor(Constants.Colors.interchatBlue)
      .setFooter({ text: `Blacklisted by: ${mod.username}`, iconURL: mod.displayAvatarURL() });

    await sendLog(opts.mod.client.cluster, logConfig?.config.modLogs.channelId, embed);
  }

  public static isServerBlacklist(data: Infraction | null) {
    return data?.serverId !== null && data?.serverName === null;
  }
}
