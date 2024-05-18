import { stripIndents } from 'common-tags';
import { User, Guild, EmbedBuilder } from 'discord.js';
import BlacklistManager from '../../managers/BlacklistManager.js';
import { emojis, colors } from '../Constants.js';
import { fetchHub, toTitleCase } from '../Utils.js';
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
  opts: {
    userOrServer: User | Guild;
    mod: User;
    reason: string;
    expires?: Date;
  },
) => {
  const { userOrServer, mod, reason, expires } = opts;

  const hub = await fetchHub(hubId);
  if (!hub?.logChannels?.modLogs) return;

  const name = userOrServer instanceof User ? userOrServer.username : userOrServer.name;
  const iconURL =
    userOrServer instanceof User
      ? userOrServer.displayAvatarURL()
      : userOrServer.iconURL() ?? undefined;
  const type = userOrServer instanceof User ? 'User' : 'Server';

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${type} ${name} blacklisted`, iconURL })
    .setDescription(
      stripIndents`
				${emojis.dotBlue} **${type}:** ${name} (${userOrServer.id})
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

export const logUnblacklist = async (
  hubId: string,
  opts: {
    type: 'user' | 'server';
    userOrServerId: string;
    mod: User;
    reason?: string;
  },
) => {
  const hub = await fetchHub(hubId);
  if (!hub?.logChannels?.modLogs) return;

  let name: string | undefined;
  let blacklisted;
  let originalReason: string | undefined;

  if (opts.type === 'user') {
    blacklisted = await BlacklistManager.fetchUserBlacklist(hub.id, opts.userOrServerId);
    name =
      (await opts.mod.client.users.fetch(opts.userOrServerId).catch(() => null))?.username ??
      `${blacklisted?.username}`;
    originalReason = blacklisted?.blacklistedFrom.find((h) => h.hubId === hub.id)?.reason;
  }
  else {
    blacklisted = await BlacklistManager.fetchServerBlacklist(hub.id, opts.userOrServerId);
    name = blacklisted?.serverName;
  }

  const embed = new EmbedBuilder()
    .setAuthor({ name: `${toTitleCase(opts.type)} ${name} unblacklisted` })
    .setDescription(
      stripIndents`
				${emojis.dotBlue} **User:** ${name} (${opts.userOrServerId})
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
      iconURL: opts.mod.displayAvatarURL(),
    });

  await sendLog(opts.mod.client, hub.logChannels.modLogs, embed);
};
