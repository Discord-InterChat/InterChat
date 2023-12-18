import { Prisma, hubs } from '@prisma/client';
import { EmbedBuilder, Snowflake } from 'discord.js';
import { colors, emojis } from '../../utils/Constants.js';
import { stripIndents } from 'common-tags';

type logChannelType = Prisma.$HubLogChannelsPayload['scalars'];

export function genLogInfoEmbed(hubInDb: hubs) {
  const { reports, modLogs, profanity, joinLeave } = (hubInDb.logChannels || {}) as logChannelType;

  return new EmbedBuilder()
    .setAuthor({ name: hubInDb.name, iconURL: hubInDb.iconUrl })
    .setTitle('Manage Hub Logs')
    .setDescription(
      stripIndents`
        Choose a log type from the dropdown below to select a channel.
        <:arrow:1186172756031717487> \`reports:\`
        <:divider:1077200517379403816> Log reports made by users of the hub.
        <:divider_end:1077200586803527690> **Channel:** ${channelMention(reports)}
        <:arrow:1186172756031717487> \`modLogs:\`
        <:divider:1077200517379403816> Log moderation actions taken by hub moderators.
        <:divider_end:1077200586803527690> **Channel:** ${channelMention(modLogs)}
        <:arrow:1186172756031717487> \`msgEdit:\`
        <:divider:1077200517379403816> Log message when it is edited.
        <:divider_end:1077200586803527690> **Channel:** ${undefined ?? emojis.no}
        <:arrow:1186172756031717487> \`msgDelete:\`
        <:divider:1077200517379403816> Log message when it is deleted.
        <:divider_end:1077200586803527690> **Channel:** ${undefined ?? emojis.no}
        <:arrow:1186172756031717487> \`profanity:\`
        <:divider:1077200517379403816> Log messages that contains profanity.
        <:divider_end:1077200586803527690> **Channel:** ${channelMention(profanity)}
        <:arrow:1186172756031717487> \`joinLeave:\`
        <:divider:1077200517379403816> Log when a new server joins or leaves the hub.
        <:divider_end:1077200586803527690> **Channel:** ${channelMention(joinLeave)}
  `,
    )
    .setColor(colors.interchatBlue)
    .setTimestamp()
    .setFooter({
      text: 'Note: This is still experimental. Report any bugs using /support report',
    });
}

export function channelMention(channelId: Snowflake | null | undefined) {
  if (!channelId) return emojis.no;
  return `<#${channelId}>`;
}
