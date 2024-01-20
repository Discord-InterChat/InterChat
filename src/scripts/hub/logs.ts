import { Prisma, hubs } from '@prisma/client';
import { Client, EmbedBuilder, GuildTextBasedChannel, messageLink } from 'discord.js';
import { colors, emojis } from '../../utils/Constants.js';
import { stripIndents } from 'common-tags';
import { channelMention } from '../../utils/Utils.js';
import { t } from '../../utils/Locale.js';
import db from '../../utils/Db.js';

/*
for later:
${emojis.arrow} \`msgEdit:\`
${emojis.divider} Log message when it is edited.
${emojis.dividerEnd} ${channelStr} ${undefined ?? emojis.no}
${emojis.arrow} \`msgDelete:\`
${emojis.divider} Log message when it is deleted.
${emojis.dividerEnd} ${channelStr} ${undefined ?? emojis.no}
*/

export function genLogInfoEmbed(hubInDb: hubs, locale = 'en') {
  const { reports, modLogs, profanity, joinLeaves } = (hubInDb.logChannels ||
    {}) as Prisma.HubLogChannelsCreateInput;
  const reportRole = reports?.roleId ? `<@&${reports.roleId}>` : emojis.no;
  const channelStr = t({ phrase: 'hub.manage.logs.config.fields.channel', locale });
  const roleStr = t({ phrase: 'hub.manage.logs.config.fields.role', locale });

  return new EmbedBuilder()
    .setTitle(t({ phrase: 'hub.manage.logs.title', locale }))
    .setDescription(
      stripIndents`
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
    .setColor(colors.invisible)
    .setThumbnail(hubInDb.iconUrl)
    .setFooter({
      text: 'Note: This feature is still experimental. Report bugs using /support report.',
    });
}

export async function getJumpLinkForReports(
  client: Client,
  opts: {
    hubId: string;
    messageId?: string;
    reportsChannelId: string;
  },
) {
  if (!opts.messageId) return;

  const messageInDb = await db.broadcastedMessages.findFirst({
    where: { messageId: opts.messageId },
    include: { originalMsg: { include: { broadcastMsgs: true } } },
  });

  // fetch the reports server ID from the log channel's ID
  const reportsServerId = client.resolveEval<string | undefined>(
    await client.cluster.broadcastEval(
      async (cl, ctx) => {
        const channel = (await cl.channels
          .fetch(ctx.reportsChannelId)
          .catch(() => null)) as GuildTextBasedChannel | null;
        return channel?.guild.id;
      },
      { context: { reportsChannelId: opts.reportsChannelId } },
    ),
  );

  if (messageInDb) {
    const networkChannel = await db.connectedList.findFirst({
      where: { serverId: reportsServerId, hubId: opts.hubId },
    });
    const reportsServerMsg = messageInDb.originalMsg.broadcastMsgs.find(
      (msg) => msg.channelId === networkChannel?.channelId,
    );

    return networkChannel && reportsServerMsg
      ? messageLink(networkChannel.channelId, reportsServerMsg.messageId, networkChannel.serverId)
      : undefined;
  }
}
