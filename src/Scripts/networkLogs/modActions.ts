import { stripIndents } from 'common-tags';
import { colors, constants } from '../../Utils/functions/utils';
import { EmbedBuilder, Guild, GuildTextBasedChannel, User } from 'discord.js';
import { blacklistedServers } from '.prisma/client';

interface actionUser {
  user: User;
  action: 'blacklistUser' | 'unblacklistUser';
  timestamp: Date;
  reason?: string | null;
}

interface actionServer {
  guild: {
    id: string;
    resolved?: Guild;
    dbResult?: blacklistedServers;
  };
  action: 'blacklistServer' | 'leave' | 'disconnect';
  timestamp: Date;
  reason?: string | null;
}
interface serverUnblacklist {
  dbGuild: blacklistedServers;
  action: 'unblacklistServer';
  timestamp: Date;
  reason?: string | null;
}

export async function modActions(moderator: User, action: actionUser | actionServer | serverUnblacklist) {
  if (!action.reason) action.reason = 'No reason provided.';

  const modLogs = await moderator.client.channels.fetch(constants.channel.modlogs) as GuildTextBasedChannel;
  const emoji = moderator.client.emoji;

  let guild: Guild | undefined;

  if (action.action !== 'blacklistUser' && action.action !== 'unblacklistUser' && action.action !== 'unblacklistServer') {
    guild = (action as actionServer).guild.resolved || moderator.client.guilds.cache.get((action as actionServer).guild.id);
  }


  switch (action.action) {
    case 'blacklistUser':
      await modLogs.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: moderator.tag, iconURL: moderator.avatarURL()?.toString() })
            .setTitle('User Blacklisted')
            .setDescription(stripIndents`
                        ${emoji.normal.dotYellow} **User:** ${action.user.tag} (${action.user.id})
                        ${emoji.normal.dotYellow} **Moderator:** ${moderator.tag} (${moderator.id})
                        ${emoji.normal.dotYellow} **Timestamp:** <t:${Math.round(action.timestamp.getTime() / 1000)}:R>`)
            .addFields({ name: 'Reason', value: action.reason })
            .setColor(colors('invisible')),
        ],
      });
      break;

    case 'unblacklistUser':
      await modLogs.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: moderator.tag, iconURL: moderator.avatarURL()?.toString() })
            .setTitle('User Unblacklisted')
            .setDescription(stripIndents`
                        ${emoji.normal.dotYellow} **User:** ${action.user.tag} (${action.user.id})
                        ${emoji.normal.dotYellow} **Moderator:** ${moderator.tag} (${moderator.id})
                        ${emoji.normal.dotYellow} **Timestamp:** <t:${Math.round(action.timestamp.getTime() / 1000)}:R>`)
            .addFields({ name: 'Reason', value: action.reason })
            .setColor(colors('invisible')),
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
                        ${emoji.normal.dotYellow} **Server:** ${guild?.name} (${guild?.id})
                        ${emoji.normal.dotYellow} **Moderator:** ${moderator.tag} (${moderator.id})
                        ${emoji.normal.dotYellow} **Timestamp:** <t:${Math.round(action.timestamp.getTime() / 1000)}:R>`)
            .addFields({ name: 'Reason', value: action.reason })
            .setColor(colors('invisible')),
        ],
      });
      break;

    case 'unblacklistServer': {
      await modLogs.send({
        embeds: [
          new EmbedBuilder()
            .setAuthor({ name: `${action.dbGuild.serverName}` })
            .setTitle('Server Unblacklisted')
            .setDescription(stripIndents`
                        ${emoji.normal.dotYellow} **Server:** ${action.dbGuild.serverName} (${action.dbGuild.serverId})
                        ${emoji.normal.dotYellow} **Moderator:** ${moderator.tag} (${moderator.id})
                        ${emoji.normal.dotYellow} **Timestamp:** <t:${Math.round(action.timestamp.getTime() / 1000)}:R>`)
            .addFields({ name: 'Reason', value: action.reason })
            .setColor(colors('invisible')),
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
                        ${emoji.normal.dotYellow} **Server:** ${guild?.name} (${guild?.id})
                        ${emoji.normal.dotYellow} **Moderator:** ${moderator.tag} (${moderator.id})
                        ${emoji.normal.dotYellow} **Timestamp:** <t:${Math.round(action.timestamp.getTime() / 1000)}:R>`)
            .addFields({ name: 'Reason', value: action.reason })
            .setColor(colors('invisible')),
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
                        ${emoji.normal.dotYellow} **Server:** ${guild?.name} (${guild?.id})
                        ${emoji.normal.dotYellow} **Moderator:** ${moderator.tag} (${moderator.id})
                        ${emoji.normal.dotYellow} **Timestamp:** <t:${Math.round(action.timestamp.getTime() / 1000)}:R>`)
            .addFields({ name: 'Reason', value: action.reason })
            .setColor(colors('invisible')),
        ],
      });
      break;
    }

    default:
      break;
  }
}