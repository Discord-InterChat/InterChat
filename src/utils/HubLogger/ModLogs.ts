import BlacklistManager from '#main/managers/BlacklistManager.js';
import ServerInfractionManager from '#main/managers/InfractionManager/ServerInfractionManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import db from '#utils/Db.js';
import type { Hub, HubLogConfig } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { type Client, codeBlock, EmbedBuilder, type Snowflake, User } from 'discord.js';
import Constants, { emojis } from '../../config/Constants.js';
import { resolveEval } from '../Utils.js';
import { sendLog } from './Default.js';

/**
 * Logs the blacklisting of a user or server.
 * @param userOrServer - The user or server being blacklisted.
 * @param mod - The moderator performing the blacklisting.
 * @param reason - The reason for the blacklisting.
 * @param expires - The optional expiration date for the blacklisting.
 */
export const logBlacklist = async (
  hubId: string,
  client: Client,
  opts: {
    target: User | Snowflake;
    mod: User;
    reason: string;
    expiresAt: Date | null;
  },
) => {
  const { target: _target, mod, reason, expiresAt } = opts;

  const hub = await db.hub.findFirst({ where: { id: hubId }, include: { logConfig: true } });
  if (!hub?.logConfig[0].modLogs) return;

  let name;
  let iconURL;
  let type;
  let target;

  if (typeof _target === 'string') {
    target = resolveEval(
      await client.cluster.broadcastEval(
        (c, guildId) => {
          const guild = c.guilds.cache.get(guildId);
          if (!guild) return null;

          return { name: guild.name, iconURL: guild.iconURL() ?? undefined, id: guildId };
        },
        { context: _target },
      ),
    );
    if (!target) return;

    name = target.name;
    iconURL = target.iconURL;
    type = 'Server';
  }
  else {
    target = _target;
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
};

const getUnblacklistEmbed = (
  type: 'User' | 'Server',
  opts: {
    name: string;
    id: Snowflake;
    mod: User | { id: Snowflake; username: string };
    hubName: string;
    reason?: string;
    originalReason?: string;
  },
) =>
  new EmbedBuilder()
    .setAuthor({ name: `${type} ${opts.name} unblacklisted` })
    .setDescription(
      stripIndents`
      ${emojis.dotBlue} **${type}:** ${opts.name} (${opts.id})
      ${emojis.dotBlue} **Moderator:** ${opts.mod.username} (${opts.mod.id})
      ${emojis.dotBlue} **Hub:** ${opts.hubName}
    `,
    )
    .addFields(
      {
        name: 'Reason for Unblacklist',
        value: opts.reason ?? 'No reason provided.',
        inline: true,
      },
      { name: 'Blacklisted For', value: opts.originalReason ?? 'Unknown', inline: true },
    )
    .setColor(Constants.Colors.interchatBlue)
    .setFooter({
      text: `Unblacklisted by: ${opts.mod.username}`,
      iconURL: opts.mod instanceof User ? opts.mod.displayAvatarURL() : undefined,
    });

type UnblacklistOpts = {
  id: string;
  mod: User | { id: Snowflake; username: string };
  reason?: string;
};

export const logServerUnblacklist = async (
  client: Client,
  hubId: string,
  opts: UnblacklistOpts,
) => {
  const hub = await db.hub.findFirst({ where: { id: hubId }, include: { logConfig: true } });
  const blacklistManager = new BlacklistManager(new ServerInfractionManager(opts.id));
  const blacklist = await blacklistManager.fetchBlacklist(hubId);
  if (!blacklist || !hub?.logConfig[0].modLogs) return;

  const embed = getUnblacklistEmbed('Server', {
    id: opts.id,
    name: blacklist.serverName,
    mod: opts.mod,
    hubName: hub.name,
    reason: opts.reason,
    originalReason: blacklist.reason,
  });

  await sendLog(client.cluster, hub.logConfig[0].modLogs, embed);
};

export const logUserUnblacklist = async (client: Client, hubId: string, opts: UnblacklistOpts) => {
  const hub = await db.hub.findFirst({ where: { id: hubId }, include: { logConfig: true } });
  const blacklistManager = new BlacklistManager(new UserInfractionManager(opts.id));
  const blacklist = await blacklistManager.fetchBlacklist(hubId);
  if (!blacklist || !hub?.logConfig[0].modLogs) return;

  const user = await client.users.fetch(opts.id).catch(() => null);
  const name = `${user?.username}`;

  const embed = getUnblacklistEmbed('User', {
    name,
    id: opts.id,
    mod: opts.mod,
    reason: opts.reason,
    hubName: hub.name,
    originalReason: blacklist.reason,
  });

  await sendLog(client.cluster, hub.logConfig[0].modLogs, embed);
};

export const logMsgDelete = async (
  client: Client,
  content: string,
  hub: Hub & { logConfig: HubLogConfig[] },
  opts: { userId: string; serverId: string; modName: string; imageUrl?: string },
) => {
  if (!hub?.logConfig[0].modLogs) return;

  const { userId, serverId } = opts;
  const user = await client.users.fetch(userId).catch(() => null);
  const server = await client.fetchGuild(serverId).catch(() => null);

  const embed = new EmbedBuilder()
    .setDescription(
      stripIndents`
      ### ${emojis.deleteDanger_icon} Message Deleted
      **Content:**
      ${codeBlock(content)}
    `,
    )
    .setColor(Constants.Colors.invisible)
    .setImage(opts.imageUrl ?? null)
    .addFields([
      { name: `${emojis.connect_icon} User`, value: `${user?.username} (\`${userId}\`)` },
      { name: `${emojis.rules_icon} Server`, value: `${server?.name} (\`${serverId}\`)` },
      { name: `${emojis.globe_icon} Hub`, value: hub.name },
    ])
    .setFooter({ text: `Deleted by: ${opts.modName}` });

  await sendLog(client.cluster, hub?.logConfig[0].modLogs, embed);
};
