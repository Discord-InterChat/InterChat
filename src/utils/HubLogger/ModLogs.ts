import { stripIndents } from 'common-tags';
import { User, EmbedBuilder, Snowflake, Client, codeBlock } from 'discord.js';
import { emojis, colors } from '../Constants.js';
import { fetchHub } from '../Utils.js';
import { sendLog } from './Default.js';
import SuperClient from '../../core/Client.js';
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
    expires?: Date;
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
    target = SuperClient.resolveEval(
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
    .setColor(colors.interchatBlue)
    .setFooter({ text: `Blacklisted by: ${mod.username}`, iconURL: mod.displayAvatarURL() });

  await sendLog(opts.mod.client, hub.logChannels.modLogs, embed);
};

export const logServerUnblacklist = async (
  client: Client,
  hubId: string,
  opts: { serverId: string; mod: User | { id: Snowflake; username: string }; reason?: string },
) => {
  const { serverBlacklists } = client;

  const hub = await fetchHub(hubId);
  const blacklisted = await serverBlacklists.fetchBlacklist(hubId, opts.serverId);
  const blacklistData = blacklisted?.hubs.find((data) => data.hubId === hubId);

  if (!blacklisted || !blacklistData || !hub?.logChannels?.modLogs) return;

  const embed = new EmbedBuilder()
    .setAuthor({ name: `Server ${blacklisted.serverName} unblacklisted` })
    .setDescription(
      stripIndents`
      ${emojis.dotBlue} **Server:** ${blacklisted.serverName} (${blacklisted.serverId})
      ${emojis.dotBlue} **Moderator:** ${opts.mod.username} (${opts.mod.id})
      ${emojis.dotBlue} **Hub:** ${hub?.name}
    `,
    )
    .addFields(
      {
        name: 'Unblacklist Reason',
        value: opts.reason ?? 'No reason provided.',
        inline: true,
      },
      { name: 'Blacklisted For', value: blacklistData.reason ?? 'Unknown', inline: true },
    )
    .setColor(colors.interchatBlue)
    .setFooter({
      text: `Unblacklisted by: ${opts.mod.username}`,
      iconURL: opts.mod instanceof User ? opts.mod.displayAvatarURL() : undefined,
    });

  await sendLog(client, hub.logChannels.modLogs, embed);
};

export const logUserUnblacklist = async (
  client: Client,
  hubId: string,
  opts: { userId: string; mod: User | { id: Snowflake; username: string }; reason?: string },
) => {
  const { userBlacklists } = client;

  const hub = await fetchHub(hubId);
  const blacklisted = await userBlacklists.fetchBlacklist(hubId, opts.userId);
  if (!blacklisted || !hub?.logChannels?.modLogs) return;

  const user = await client.users.fetch(opts.userId).catch(() => null);
  const name = user?.username ?? `${blacklisted?.username}`;
  const originalReason = blacklisted?.blacklistedFrom.find((h) => h.hubId === hub.id)?.reason;

  const embed = new EmbedBuilder()
    .setAuthor({ name: `User ${name} unblacklisted` })
    .setDescription(
      stripIndents`
        ${emojis.dotBlue} **User:** ${name} (${opts.userId})
        ${emojis.dotBlue} **Moderator:** ${opts.mod.username} (${opts.mod.id})
	      ${emojis.dotBlue} **Hub:** ${hub?.name}
      `,
    )
    .addFields(
      {
        name: 'Reason for Unblacklist',
        value: opts.reason ?? 'No reason provided.',
        inline: true,
      },
      { name: 'Blacklisted For', value: originalReason ?? 'Unknown', inline: true },
    )
    .setColor(colors.interchatBlue)
    .setFooter({
      text: `Unblacklisted by: ${opts.mod.username}`,
      iconURL: opts.mod instanceof User ? opts.mod.displayAvatarURL() : undefined,
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
    .setColor(colors.invisible)
    .setImage(opts.imageUrl ?? null)
    .addFields([
      { name: `${emojis.connect_icon} User`, value: `${user?.username} (\`${userId}\`)` },
      { name: `${emojis.rules_icon} Server`, value: `${server?.name} (\`${serverId}\`)` },
      { name: `${emojis.globe_icon} Hub`, value: hub.name },
    ])
    .setFooter({ text: `Deleted by: ${opts.modName}` });

  await sendLog(client, hub.logChannels.modLogs, embed);
};
