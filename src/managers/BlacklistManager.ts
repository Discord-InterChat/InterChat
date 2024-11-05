import ServerInfractionManager from '#main/managers/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import Constants, { emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { sendLog } from '#main/utils/hub/logger/Default.js';
import { resolveEval } from '#main/utils/Utils.js';
import { InfractionStatus, Prisma, ServerInfraction, UserInfraction } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { Client, EmbedBuilder, User, type Snowflake } from 'discord.js';

export default class BlacklistManager {
  readonly targetId: Snowflake;
  readonly infracManager;

  constructor(infracManager: UserInfractionManager | ServerInfractionManager) {
    this.targetId = infracManager.targetId;
    this.infracManager = infracManager;
  }

  public async addBlacklist(opts: {
    hubId: string;
    reason: string;
    moderatorId: string;
    serverName: string;
    expiresAt: Date | null;
  }): Promise<ServerInfraction | null>;
  public async addBlacklist(opts: {
    hubId: string;
    reason: string;
    moderatorId: string;
    expiresAt: Date | null;
  }): Promise<UserInfraction | null>;
  public async addBlacklist(opts: {
    hubId: string;
    reason: string;
    moderatorId: string;
    serverName: string;
    expiresAt: Date | null;
  }): Promise<UserInfraction | ServerInfraction | null> {
    const blacklisted = await this.fetchBlacklist(opts.hubId);

    if (blacklisted) {
      return await this.infracManager.updateInfraction(
        { hubId: opts.hubId, type: 'BLACKLIST', status: 'ACTIVE' },
        {
          dateIssued: new Date(),
          expiresAt: opts.expiresAt,
          reason: opts.reason,
          moderatorId: opts.moderatorId,
        },
      );
    }

    return await this.infracManager.addInfraction('BLACKLIST', opts);
  }

  public async removeBlacklist(
    hubId: string,
    status: Exclude<InfractionStatus, 'ACTIVE'> = 'REVOKED',
  ) {
    const exists = await this.fetchBlacklist(hubId);
    if (!exists) return null;

    return await this.infracManager.revokeInfraction('BLACKLIST', hubId, status);
  }

  public async updateBlacklist(
    hubId: string,
    data: Prisma.UserInfractionUpdateInput | Prisma.ServerInfractionUpdateInput,
  ) {
    const blacklisted = await this.fetchBlacklist(hubId);
    if (!blacklisted) return null;

    return await this.infracManager.updateInfraction(
      { hubId, type: 'BLACKLIST', status: 'ACTIVE' },
      data,
    );
  }

  public async fetchBlacklist(hubId: string) {
    const blacklist = await this.infracManager.fetchInfraction('BLACKLIST', hubId, 'ACTIVE');
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

    const hub = await db.hub.findFirst({ where: { id: hubId }, include: { logConfig: true } });
    if (!hub?.logConfig[0].modLogs) return;

    let name;
    let iconURL;
    let type;
    let target;

    if (this.infracManager instanceof ServerInfractionManager) {
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
				${emojis.dotBlue} **Hub:** ${hub?.name}
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

    await sendLog(opts.mod.client.cluster, hub?.logConfig[0].modLogs, embed);
  }

  public static isServerBlacklist(
    data: UserInfraction | ServerInfraction | null,
  ): data is ServerInfraction {
    return Boolean(data && 'serverId' in data);
  }
}
