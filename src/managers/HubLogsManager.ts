import db from '../utils/Db.js';
import { stripIndents } from 'common-tags';
import { EmbedBuilder, User, Guild, messageLink, GuildTextBasedChannel } from 'discord.js';
import { emojis, colors } from '../utils/Constants.js';
import { toTitleCase } from '../utils/Utils.js';
import SuperClient from '../SuperClient.js';
import BlacklistManager from './BlacklistManager.js';
import { Prisma } from '@prisma/client';

export type reportEvidenceOpts = {
  // the message content
  content?: string;
  messageId?: string;
  attachmentUrl?: string;
};

export default class HubLogsManager {
  private readonly client = SuperClient.getInstance();

  public hubId: string;
  private reports?: Prisma.hubLogReportsCreateInput;
  private modChannelId?: string;
  private profanityChannelId?: string;
  private joinLeaveChannelId?: string;

  constructor(hubId: string) {
    this.hubId = hubId;
  }

  async init() {
    const hub = await this.fetchHub();
    if (!hub) throw new Error('Hub not found.');
    if (hub) {
      this.profanityChannelId = hub.logChannels?.profanity ?? undefined;
      this.modChannelId = hub.logChannels?.modLogs ?? undefined;
      this.reports = hub.logChannels?.reports ?? undefined;
      this.joinLeaveChannelId = hub.logChannels?.joinLeaves ?? undefined;
    }

    return this;
  }

  async fetchHub() {
    return await db.hubs.findFirst({ where: { id: this.hubId } });
  }

  // setters
  public set setHubId(hubId: string) {
    this.hubId = hubId;
  }

  public set channel(obj: { type: 'profanity' | 'modLogs' | 'joinLeaves'; channelId: string }) {
    db.hubs
      .update({
        where: { id: this.hubId },
        data: {
          logChannels: {
            upsert: {
              set: { [obj.type]: obj.channelId },
              update: { [obj.type]: obj.channelId },
            },
          },
        },
      })
      .then(void 0);
  }
  public set profanity(channelId: string) {
    this.channel = { type: 'profanity', channelId };
    this.profanityChannelId = channelId;
  }

  public set modLogs(channelId: string) {
    this.channel = { type: 'modLogs', channelId };
    this.modChannelId = channelId;
  }

  public set joinLeaves(channelId: string) {
    this.channel = { type: 'joinLeaves', channelId };
    this.joinLeaveChannelId = channelId;
  }

  public async setReportData(data: { channelId?: string; roleId?: string | null } | null) {
    const reports = data as Prisma.hubLogReportsCreateInput | null;

    // unset reports
    if (!reports) {
      const hub = await this.fetchHub();
      const logChannels = { ...hub?.logChannels };
      delete logChannels.reports;

      await db.hubs.update({
        where: { id: this.hubId },
        data: { logChannels },
      });
      return;
    }

    // unset roleId
    if (data?.roleId === null) delete reports?.roleId;

    // if no channelId is provided, use the one in the database
    if (!reports.channelId) {
      // if there is no report channel even after fetching from database, throw an error
      if (!this.reports?.channelId) throw new Error('No report channel found.');

      // if there is a report channel, use that
      reports.channelId = this.reports.channelId;
    }

    await db.hubs.update({
      where: { id: this.hubId },
      data: { logChannels: { upsert: { set: { reports }, update: { reports } } } },
    });
  }

  /**
   * Sends a log message to the specified channel with the provided embed.
   * @param channelId The ID of the channel to send the log message to.
   * @param embed The embed object containing the log message.
   */
  public async sendLog(channelId: string, embed: EmbedBuilder, content?: string) {
    this.client.cluster.broadcastEval(
      async (client, ctx) => {
        const channel = await client.channels.fetch(ctx.channelId).catch(() => null);
        if (!channel?.isTextBased()) return;

        await channel.send({ content: ctx.content, embeds: [ctx.embed] }).catch(() => null);
      },
      { context: { channelId, embed, content } },
    );
  }

  /**
   * Logs the detected profanity along with relevant details.
   * @param rawContent - The raw content containing the profanity.
   * @param author - The user who posted the content.
   * @param server - The server where the content was posted.
   */
  async logProfanity(rawContent: string, author: User, server: Guild) {
    if (!this.profanityChannelId) return;

    const hub = await this.fetchHub();
    const embed = new EmbedBuilder()
      .setTitle('Profanity Detected')
      .setDescription(`||${rawContent}||`)
      .setColor(colors.interchatBlue)
      .addFields({
        name: 'Details',
        value: stripIndents`
					${emojis.dotBlue} **Author:** @${author.username} (${author.id})
					${emojis.dotBlue} **Server:** ${server.name} (${server.id}})
					${emojis.dotBlue} **Hub:** ${hub?.name}
				`,
      });

    await this.sendLog(this.profanityChannelId, embed);
  }

  /**
   * Logs the blacklisting of a user or server.
   * @param userOrServer - The user or server being blacklisted.
   * @param mod - The moderator performing the blacklisting.
   * @param reason - The reason for the blacklisting.
   * @param expires - The optional expiration date for the blacklisting.
   */
  async logBlacklist(userOrServer: User | Guild, mod: User, reason: string, expires?: Date) {
    if (!this.modChannelId) return;

    const hub = await this.fetchHub();
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

    await this.sendLog(this.modChannelId, embed);
  }

  async logUnblacklist(
    type: 'user' | 'server',
    userOrServerId: string,
    mod: User,
    opts?: { reason?: string },
  ) {
    if (!this.modChannelId) return;

    const hub = await this.fetchHub();

    let name: string | undefined;
    let blacklisted;
    let originalReason: string | undefined = undefined;

    if (type === 'user') {
      blacklisted = await BlacklistManager.fetchUserBlacklist(this.hubId, userOrServerId);
      name =
        (await this.client.users.fetch(userOrServerId).catch(() => null))?.username ??
        blacklisted?.username;
      originalReason = blacklisted?.blacklistedFrom.find((h) => h.hubId === this.hubId)?.reason;
    }
    else {
      blacklisted = await BlacklistManager.fetchServerBlacklist(this.hubId, userOrServerId);
      name = blacklisted?.serverName;
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${toTitleCase(type)} ${name} unblacklisted` })
      .setDescription(
        stripIndents`
				${emojis.dotBlue} **User:** ${name} (${userOrServerId})
				${emojis.dotBlue} **Moderator:** ${mod.username} (${mod.id})
				${emojis.dotBlue} **Hub:** ${hub?.name}
			`,
      )
      .addFields(
        {
          name: 'Reason for Unblacklist',
          value: opts?.reason ?? 'No reason provided.',
          inline: true,
        },
        { name: 'Blacklisted For', value: originalReason ?? 'Unknown', inline: true },
      )
      .setColor(colors.interchatBlue)
      .setFooter({ text: `Unblacklisted by: ${mod.username}`, iconURL: mod.displayAvatarURL() });

    await this.sendLog(this.modChannelId, embed);
  }

  /**
   * Logs a report with the specified details.
   * @param userId - The ID of the user being reported.
   * @param serverId - The ID of the server being reported.
   * @param reason - The reason for the report.
   * @param reportedBy - The user who reported the incident.
   * @param evidence - Optional evidence for the report.
   */
  async logReport(
    userId: string,
    serverId: string,
    reason: string,
    reportedBy: User,
    evidence?: reportEvidenceOpts,
  ) {
    if (!this.reports?.channelId) return;

    const server = await this.client.fetchGuild(serverId);

    // TODO: make it mandatory for hubs to set a report channel
    // and support server
    const embed = new EmbedBuilder()
      .setTitle('New Report')
      .setColor('Red')
      .setImage(evidence?.attachmentUrl || null)
      .setDescription(
        stripIndents`
        ${emojis.dotRed} **Reported User:** <@${userId}> (${userId})
        ${emojis.dotRed} **Reported Server:** ${server?.name} (${serverId})

        ${emojis.info} **Message Content:**
        \`\`\`${evidence?.content?.replaceAll('`', '\\`')}\`\`\`
      `,
      )
      .addFields({ name: 'Reason', value: reason, inline: true })
      .setFooter({
        text: `Reported by: ${reportedBy.username}`,
        iconURL: reportedBy.displayAvatarURL(),
      });

    if (evidence?.messageId) {
      const messageInDb = await db.broadcastedMessages.findFirst({
        where: { messageId: evidence.messageId },
        include: { originalMsg: { include: { broadcastMsgs: true } } },
      });

      const reportsServerId = this.client.resolveEval<string | undefined>(
        await this.client.cluster.broadcastEval(
          async (client, ctx) => {
            const channel = (await client.channels
              .fetch(ctx.channelId)
              .catch(() => null)) as GuildTextBasedChannel | null;
            return channel?.guild.id;
          },
          { context: { channelId: this.reports.channelId } },
        ),
      );

      if (messageInDb) {
        const networkChannel = await db.connectedList.findFirst({
          where: { serverId: reportsServerId, hubId: this.hubId },
        });
        const reportsServerMsg = messageInDb.originalMsg.broadcastMsgs.find((msg) => msg.channelId === networkChannel?.channelId);

        const jumpUrl = networkChannel && reportsServerMsg
          ? messageLink(networkChannel.channelId, reportsServerMsg.messageId, networkChannel.serverId)
          : undefined;

        if (jumpUrl) embed.addFields({ name: 'Jump to Message', value: jumpUrl, inline: true });
      }
    }

    const mentionRole = this.reports.roleId ? `<@&${this.reports.roleId}>` : undefined;
    await this.sendLog(this.reports.channelId, embed, mentionRole);
  }

  async logServerJoin(server: Guild, opt?: { totalConnections: number; hubName: string }) {
    if (!this.joinLeaveChannelId) return;

    const owner = await server.fetchOwner();

    const embed = new EmbedBuilder()
      .setTitle('New Server Joined')
      .setDescription(
        stripIndents`
        ${emojis.dotBlue} **Server:** ${server.name} (${server.id})
        ${emojis.dotBlue} **Owner:** ${owner.user.tag} (${server.ownerId})
        ${emojis.dotBlue} **Member Count:** ${server.memberCount}
      `,
      )
      .setColor(colors.interchatBlue)
      .setThumbnail(server.iconURL())
      .setFooter({
        text: `We have ${opt?.totalConnections} server(s) connected to ${opt?.hubName} now!`,
      });

    await this.sendLog(this.joinLeaveChannelId, embed);
  }

  async logServerLeave(server: Guild) {
    if (!this.joinLeaveChannelId) return;

    const totalConnections = await db.connectedList.count({
      where: { hubId: this.hubId, connected: true },
    });
    const hubName = (await this.fetchHub())?.name;

    const owner = await server.fetchOwner();

    const embed = new EmbedBuilder()
      .setTitle('Server Left')
      .setDescription(
        stripIndents`
        ${emojis.dotRed} **Server:** ${server.name} (${server.id})
        ${emojis.dotRed} **Owner:** ${owner.user.tag} (${server.ownerId})
        ${emojis.dotRed} **Member Count:** ${server.memberCount}
      `,
      )
      .setColor('Red')
      .setThumbnail(server.iconURL())
      .setFooter({
        text: `We now have ${totalConnections} server(s) connected to ${hubName} now!`,
      });

    this.sendLog(this.joinLeaveChannelId, embed);
  }
}
