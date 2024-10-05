import { stripIndents } from 'common-tags';
import {
  EmbedBuilder,
  messageLink,
  roleMention,
  type Client,
  type GuildTextBasedChannel,
  type User,
} from 'discord.js';
import { emojis } from '../../config/Constants.js';
import db from '../Db.js';
import { resolveEval } from '../Utils.js';
import { sendLog } from './Default.js';

export type ReportEvidenceOpts = {
  // the message content
  content?: string;
  messageId?: string;
  attachmentUrl?: string;
};

export type LogReportOpts = {
  userId: string;
  serverId: string;
  reason: string;
  reportedBy: User;
  evidence?: ReportEvidenceOpts;
};

/**
 * Retrieves the jump link for a specific message in the reports channel of a hub.
 * @param hubId - The ID of the hub.
 * @param messageId - The ID of the message. (optional)
 * @param reportsChannelId - The ID of the reports channel.
 * @returns The jump link for the specified message, or undefined if the message is not found.
 */
const genJumpLink = async (
  hubId: string,
  client: Client,
  messageId: string | undefined,
  reportsChannelId: string,
) => {
  if (!messageId) return null;

  const messageInDb = await db.broadcastedMessages.findFirst({
    where: { messageId },
    include: { originalMsg: { include: { broadcastMsgs: true } } },
  });
  if (!messageInDb) return null;

  // fetch the reports server ID from the log channel's ID
  const reportsServerId = resolveEval(
    await client.cluster.broadcastEval(
      async (cl, channelId) => {
        const channel = (await cl.channels
          .fetch(channelId)
          .catch(() => null)) as GuildTextBasedChannel | null;
        return channel?.guild.id;
      },
      { context: reportsChannelId },
    ),
  );

  const networkChannel = await db.connectedList.findFirst({
    where: { serverId: reportsServerId, hubId },
  });
  const reportsServerMsg = messageInDb.originalMsg.broadcastMsgs.find(
    (msg) => msg.channelId === networkChannel?.channelId,
  );

  if (!networkChannel || !reportsServerMsg) return null;
  return messageLink(networkChannel.channelId, reportsServerMsg.messageId, networkChannel.serverId);
};

/**
 * Logs a report with the specified details.
 * @param userId - The ID of the user being reported.
 * @param serverId - The ID of the server being reported.
 * @param reason - The reason for the report.
 * @param reportedBy - The user who reported the incident.
 * @param evidence - Optional evidence for the report.
 */
export const sendHubReport = async (
  hubId: string,
  client: Client,
  { userId, serverId, reason, reportedBy, evidence }: LogReportOpts,
) => {
  const hub = await db.hub.findFirst({ where: { id: hubId }, include: { logConfig: true } });
  if (!hub?.logConfig[0]?.reports?.channelId) return;

  const { channelId: reportsChannelId, roleId: reportsRoleId } = hub.logConfig[0].reports;
  const server = await client.fetchGuild(serverId);
  const jumpLink = await genJumpLink(hubId, client, evidence?.messageId, reportsChannelId);

  // TODO: make it mandatory for hubs to set a report channel and support server
  const embed = new EmbedBuilder()
    .setTitle('New Report')
    .setColor('Red')
    .setImage(evidence?.attachmentUrl ?? null)
    .setDescription(
      stripIndents`
        ${emojis.dotRed} **Reported User:** <@${userId}> (${userId})
        ${emojis.dotRed} **Reported Server:** ${server?.name} (${serverId})

        ${emojis.info} **Message Content:**
        \`\`\`${evidence?.content?.replaceAll('`', '\\`')}\`\`\`
      `,
    )
    .addFields([
      { name: 'Reason', value: reason, inline: true },
      { name: 'Jump To Reported Message', value: jumpLink ?? 'N/A', inline: true },
    ])
    .setFooter({
      text: `Reported by: ${reportedBy.username}`,
      iconURL: reportedBy.displayAvatarURL(),
    });

  const mentionRole = reportsRoleId ? roleMention(reportsRoleId) : undefined;
  await sendLog(client.cluster, reportsChannelId, embed, mentionRole);
};
