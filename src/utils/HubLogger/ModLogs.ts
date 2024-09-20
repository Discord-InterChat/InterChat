import { stripIndents } from 'common-tags';
import { User, EmbedBuilder, Snowflake, Client, codeBlock } from 'discord.js';
import Constants, { emojis } from '../../config/Constants.js';
import { fetchHub, resolveEval } from '../Utils.js';
import { sendLog } from './Default.js';
import { hubs } from '@prisma/client';

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
    expires: Date | null;
  },
) => {
  const { target: _target, mod, reason, expires } = opts;

  const hub = await fetchHub(hubId);
  if (!hub?.logChannels?.modLogs) return;

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
        value: expires ? `<t:${Math.round(expires.getTime() / 1000)}:R>` : 'Never.',
        inline: true,
      },
    )
    .setColor(Constants.Colors.interchatBlue)
    .setFooter({ text: `Blacklisted by: ${mod.username}`, iconURL: mod.displayAvatarURL() });

  await sendLog(opts.mod.client, hub.logChannels.modLogs, embed);
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
  const hub = await fetchHub(hubId);
  const blacklisted = await client.serverBlacklists.fetchBlacklist(hubId, opts.id);
  const blacklistData = blacklisted?.blacklistedFrom.find((data) => data.hubId === hubId);

  if (!blacklisted || !blacklistData || !hub?.logChannels?.modLogs) return;

  const embed = getUnblacklistEmbed('Server', {
    name: blacklisted.serverName,
    id: opts.id,
    mod: opts.mod,
    reason: opts.reason,
    hubName: hub.name,
    originalReason: blacklistData.reason,
  });

  await sendLog(client, hub.logChannels.modLogs, embed);
};

export const logUserUnblacklist = async (client: Client, hubId: string, opts: UnblacklistOpts) => {
  const hub = await fetchHub(hubId);
  const blacklisted = await client.userManager.fetchBlacklist(hubId, opts.id);
  if (!blacklisted || !hub?.logChannels?.modLogs) return;

  const user = await client.users.fetch(opts.id).catch(() => null);
  const name = user?.username ?? `${blacklisted?.username}`;
  const originalReason = blacklisted?.blacklistedFrom.find((h) => h.hubId === hub.id)?.reason;

  const embed = getUnblacklistEmbed('User', {
    name,
    id: opts.id,
    mod: opts.mod,
    reason: opts.reason,
    hubName: hub.name,
    originalReason,
  });

  await sendLog(client, hub.logChannels.modLogs, embed);
};

export const logMsgDelete = async (
  client: Client,
  content: string,
  hub: hubs,
  opts: { userId: string; serverId: string; modName: string; imageUrl?: string },
) => {
  if (!hub.logChannels?.modLogs) return;

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

  await sendLog(client, hub.logChannels.modLogs, embed);
};
