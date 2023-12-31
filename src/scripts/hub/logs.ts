import { Prisma, hubs } from '@prisma/client';
import { EmbedBuilder } from 'discord.js';
import { colors, emojis } from '../../utils/Constants.js';
import { stripIndents } from 'common-tags';
import { channelMention } from '../../utils/Utils.js';

/*
for later:
${emojis.arrow} \`msgEdit:\`
${emojis.divider} Log message when it is edited.
${emojis.dividerEnd} Channel: ${undefined ?? emojis.no}
${emojis.arrow} \`msgDelete:\`
${emojis.divider} Log message when it is deleted.
${emojis.dividerEnd} Channel: ${undefined ?? emojis.no}
*/

// FIXME errors

export function genLogInfoEmbed(hubInDb: hubs) {
  // NOTE: reports is actually [string, string] | undefined but prisma doesnt support optional arrays
  const { reports, modLogs, profanity, joinLeaves } = (hubInDb.logChannels || {}) as Prisma.HubLogChannelsCreateInput;
  const reportRole = reports?.roleId ? `<@&${reports.roleId}>` : emojis.no;

  return new EmbedBuilder()
    .setTitle('Manage Hub Logs')
    .setDescription(
      stripIndents`
        Choose a log type from the dropdown below to select a channel.
        ${emojis.arrow} \`reports:\`
        ${emojis.divider} Log reports made by users of the hub.
        ${emojis.divider} Channel: ${channelMention(reports?.channelId)}
        ${emojis.dividerEnd} Role Mention: ${reportRole}
        ${emojis.arrow} \`modLogs:\`
        ${emojis.divider} Log moderation actions taken by hub moderators.
        ${emojis.dividerEnd} Channel: ${channelMention(modLogs)}
        ${emojis.arrow} \`profanity:\`
        ${emojis.divider} Log messages that contains profanity.
        ${emojis.dividerEnd} Channel: ${channelMention(profanity)}
        ${emojis.arrow} \`joinLeave:\`
        ${emojis.divider} Log when a new server joins or leaves the hub.
        ${emojis.dividerEnd} Channel: ${channelMention(joinLeaves)}
  `,
    )
    .setColor(colors.invisible)
    .setThumbnail(hubInDb.iconUrl)
    .setFooter({
      text: 'Note: This feature is still experimental. Report bugs using /support report.',
    });
}
