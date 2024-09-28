import { emojis } from '#main/config/Constants.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import { Prisma, Hub } from '@prisma/client';
import { stripIndents } from 'common-tags';

/*
for later:
${emojis.arrow} \`msgEdit:\`
${emojis.divider} Log message when it is edited.
${emojis.dividerEnd} ${channelStr} ${undefined ?? emojis.no}
${emojis.arrow} \`msgDelete:\`
${emojis.divider} Log message when it is deleted.
${emojis.dividerEnd} ${channelStr} ${undefined ?? emojis.no}
*/

const channelMention = (channelId: string | null | undefined) =>
  channelId ? `<#${channelId}>` : emojis.no;

export const genLogInfoEmbed = (hubInDb: Hub, locale: supportedLocaleCodes = 'en') => {
  const { reports, modLogs, profanity, joinLeaves } = (hubInDb.logChannels ||
    {}) as Prisma.HubLogChannelsCreateInput;
  const reportRole = reports?.roleId ? `<@&${reports.roleId}>` : emojis.no;
  const channelStr = t({ phrase: 'hub.manage.logs.config.fields.channel', locale });
  const roleStr = t({ phrase: 'hub.manage.logs.config.fields.role', locale });

  return new InfoEmbed()
    .removeTitle()
    .setDescription(
      stripIndents`
        ## ${t({ phrase: 'hub.manage.logs.title', locale })}
      
        ${emojis.arrow} \`reports:\`
        ${emojis.divider} ${t({ phrase: 'hub.manage.logs.reports.description', locale })}
        ${emojis.divider} ${channelStr} ${channelMention(reports?.channelId)}
        ${emojis.dividerEnd} ${roleStr}: ${reportRole}
        ${emojis.arrow} \`modLogs:\`
        ${emojis.divider} ${t({ phrase: 'hub.manage.logs.modLogs.description', locale })}
        ${emojis.dividerEnd} ${channelStr} ${channelMention(modLogs)}
        ${emojis.arrow} \`profanity:\`
        ${emojis.divider} ${t({ phrase: 'hub.manage.logs.profanity.description', locale })}
        ${emojis.dividerEnd} ${channelStr} ${channelMention(profanity)}
        ${emojis.arrow} \`joinLeave:\`
        ${emojis.divider} ${t({ phrase: 'hub.manage.logs.joinLeave.description', locale })}
        ${emojis.dividerEnd} ${channelStr} ${channelMention(joinLeaves)}`,
    )
    .setThumbnail(hubInDb.iconUrl);
};
