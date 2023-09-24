import { stripIndents } from 'common-tags';
import { constants, getDb } from '../../Utils/utils';
import { EmbedBuilder, Guild, User } from 'discord.js';
import { blacklistedServers } from '.prisma/client';
import { captureMessage } from '@sentry/node';
import emojis from '../../Utils/JSON/emoji.json';

interface actionUser {
  user: User;
  action: 'blacklistUser' | 'unblacklistUser';
  reason?: string | null;
}

interface actionServer {
  guild: {
    id: string;
    resolved?: Guild;
    dbResult?: blacklistedServers;
  };
  action: 'leave' | 'disconnect' | 'blacklistServer';
  reason?: string | null;
}

interface blacklistServer extends actionServer {
  action: 'blacklistServer';
  expires?: Date;
}

interface blacklistUser extends actionUser {
  action: 'blacklistUser';
  expires?: Date;
}
interface leaveServer extends actionServer {
  action: 'leave';
}
interface disconnectServer extends actionServer {
  action: 'disconnect';
}
interface unblacklistUser {
  action: 'unblacklistUser';
  hubId: string;
  user: User;
  blacklistedFor?: string;
}

interface unblacklistServer {
  action: 'unblacklistServer';
  hubId: string;
  oldBlacklist: blacklistedServers;
  timestamp: Date;
}

// TODO: Make the logs channel into a forum, which includes the folowing posts:
// Network Log
// Reports
// Judgement
// Make sure the logs channel isn't closed before logging stuff, that will be the main problem here.
// That is the reason I have left it as a todo. :D
export async function modActions(moderator: User, action: blacklistUser | unblacklistUser | blacklistServer | unblacklistServer | leaveServer | disconnectServer) {
  const modLogs = await moderator.client.channels.fetch(constants.channel.modlogs);
  const emoji = emojis.normal;

  if (!modLogs?.isTextBased()) return captureMessage('Modlogs channel is not text based. (modActions.ts)', 'warning');

  let guild: Guild | undefined;

  if (action.action !== 'blacklistUser' && action.action !== 'unblacklistUser' && action.action !== 'unblacklistServer') {
    guild = action.guild.resolved || moderator.client.guilds.cache.get(action.guild.id);
  }

  switch (action.action) {
    case 'blacklistUser':
      await modLogs.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: moderator.username, iconURL: moderator.avatarURL()?.toString() })
            .setTitle('User Blacklisted')
            .setDescription(
              stripIndents`
              ${emoji.dotBlue} **User:** ${action.user.username} (${action.user.id})
              ${emoji.dotBlue} **Moderator:** ${moderator.username} (${moderator.id})
              `,
            )
            .addFields(
              { name: 'Reason', value: `${action.reason || 'Not Provided.'}`, inline: true },
              { name: 'Blacklist Expires', value: action.expires ? `<t:${Math.round(action.expires.getTime() / 1000)}:R>` : 'Never.', inline: true },
            )
            .setColor(constants.colors.interchatBlue),
        ],
      });
      break;


    case 'blacklistServer':
      await modLogs.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: String(guild?.name), iconURL: guild?.iconURL() || undefined })
            .setTitle('Server Blacklisted')
            .setDescription(stripIndents`
              ${emoji.dotBlue} **Server:** ${guild?.name} (${guild?.id})
              ${emoji.dotBlue} **Moderator:** ${moderator.username} (${moderator.id})
              `)
            .addFields(
              { name: 'Reason', value: `${action.reason || 'Not Provided.'}`, inline: true },
              { name: 'Blacklist Expires', value: action.expires ? `<t:${Math.round(action.expires.getTime() / 1000)}:R>` : 'Never.', inline: true },
            )
            .setColor(constants.colors.interchatBlue),
        ],
      });
      break;

    case 'unblacklistUser': {
      const hub = await getDb().hubs.findFirst({ where: { id: action.hubId } });
      await modLogs.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: moderator.username, iconURL: moderator.avatarURL()?.toString() })
            .setTitle('User Unblacklisted')
            .setColor(constants.colors.interchatBlue)
            .setDescription(stripIndents`
              ${emoji.dotBlue} **User:** ${action.user.username} (${action.user.id})
              ${emoji.dotBlue} **Hub:** ${hub?.name}
              ${emoji.dotBlue} **Moderator:** ${moderator.username} (${moderator.id})
              `)
            .addFields(
              { name: 'Blacklisted For', value: action.blacklistedFor || 'Unknown' },
            ),
        ],
      });
      break;
    }

    case 'unblacklistServer': {
      const server = await moderator.client.guilds.fetch(action.oldBlacklist.serverId).catch(() => null);
      const serverName = server?.name || action.oldBlacklist.serverName;
      const serverId = server?.id || action.oldBlacklist.serverId;
      const blacklistData = action.oldBlacklist.hubs.find(({ hubId }) => hubId === action.hubId);

      await modLogs.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: `${serverName}`, iconURL: server?.iconURL()?.toString() })
            .setTitle('Server Unblacklisted')
            .setDescription(stripIndents`
              ${emoji.dotBlue} **Server:** ${serverName} (${serverId})
              ${emoji.dotBlue} **Moderator:** ${moderator.username} (${moderator.id})
              ${emoji.dotBlue} **Hub:** ${moderator.username} (${moderator.id})
              ${emoji.dotBlue} **Blacklisted for:** ${blacklistData?.reason}
             `)
            .setTimestamp(action.timestamp)
            .setColor(constants.colors.interchatBlue),
        ],
      });
      break;
    }

    case 'leave':
      await modLogs.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: String(guild?.name), iconURL: guild?.iconURL() || undefined })
            .setTitle('Left Server')
            .setDescription(stripIndents`
              ${emoji.dotBlue} **Server:** ${guild?.name} (${guild?.id})
              ${emoji.dotBlue} **Moderator:** ${moderator.username} (${moderator.id})
              ${emoji.dotBlue} **Reason:** ${action.reason || 'Not Provided.'}
              `)
            .setColor(constants.colors.interchatBlue),
        ],
      });
      break;

    case 'disconnect': {
      await modLogs.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: String(guild?.name), iconURL: guild?.iconURL() || undefined })
            .setTitle('Disconnected from Server')
            .setDescription(stripIndents`
              ${emoji.dotBlue} **Server:** ${guild?.name} (${guild?.id})
              ${emoji.dotBlue} **Moderator:** ${moderator.username} (${moderator.id})
              ${emoji.dotBlue} **Reason:** ${action.reason || 'Not Provided.'}
              `)
            .setColor(constants.colors.interchatBlue),
        ],
      });
      break;
    }

    default:
      break;
  }
}
