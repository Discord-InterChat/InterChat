import db from '../utils/Db.js';
import { stripIndents } from 'common-tags';
import {
	EmbedBuilder,
	User,
	Guild,
	GuildTextBasedChannel,
	messageLink,
	roleMention,
} from 'discord.js';
import { emojis, colors } from '../utils/Constants.js';
import { toTitleCase } from '../utils/Utils.js';
import BlacklistManager from '../managers/BlacklistManager.js';
import { Prisma, hubs } from '@prisma/client';
import SuperClient from '../core/Client.js';
import Factory from '../core/Factory.js';

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

export default class HubLoggerService extends Factory {
	public async fetchHub(id: string) {
		return await db.hubs.findFirst({ where: { id } });
	}

	static async setLogChannelFor(
		hubId: string,
		type: keyof Prisma.HubLogChannelsCreateInput,
		channelId: string,
	) {
		if (type === 'reports') {
			await SuperClient.instance.reportLogger.setChannelId(hubId, channelId);
			return;
		}

		return await db.hubs.update({
			where: { id: hubId },
			data: {
				logChannels: {
					upsert: {
						set: { [type]: channelId },
						update: { [type]: channelId },
					},
				},
			},
		});
	}

	/**
   * Sends a log message to the specified channel with the provided embed.
   * @param channelId The ID of the channel to send the log message to.
   * @param embed The embed object containing the log message.
   */
	public async sendLog(channelId: string, embed: EmbedBuilder, content?: string) {
		await this.client.cluster.broadcastEval(
			async (client, ctx) => {
				const channel = await client.channels.fetch(ctx.channelId).catch(() => null);
				if (!channel?.isTextBased()) return;

				await channel.send({ content: ctx.content, embeds: [ctx.embed] }).catch(() => null);
			},
			{ context: { channelId, embed, content } },
		);
	}
}

export class ModLogsLogger extends HubLoggerService {
	/**
   * Logs the blacklisting of a user or server.
   * @param userOrServer - The user or server being blacklisted.
   * @param mod - The moderator performing the blacklisting.
   * @param reason - The reason for the blacklisting.
   * @param expires - The optional expiration date for the blacklisting.
   */
	async logBlacklist(
		hubId: string,
		opts: {
			userOrServer: User | Guild;
			mod: User;
			reason: string;
			expires?: Date;
		},
	) {
		const { userOrServer, mod, reason, expires } = opts;

		const hub = await this.fetchHub(hubId);
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

		await this.sendLog(hub.logChannels.modLogs, embed);
	}

	async logUnblacklist(
		hubId: string,
		type: 'user' | 'server',
		userOrServerId: string,
		mod: User,
		reason?: string,
	) {
		const hub = await this.fetchHub(hubId);
		if (!hub?.logChannels?.modLogs) return;

		let name: string | undefined;
		let blacklisted;
		let originalReason: string | undefined = undefined;

		if (type === 'user') {
			blacklisted = await BlacklistManager.fetchUserBlacklist(hub.id, userOrServerId);
			name =
        (await this.client.users.fetch(userOrServerId).catch(() => null))?.username ??
        `${blacklisted?.username}`;
			originalReason = blacklisted?.blacklistedFrom.find((h) => h.hubId === hub.id)?.reason;
		}
		else {
			blacklisted = await BlacklistManager.fetchServerBlacklist(hub.id, userOrServerId);
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
					value: reason ?? 'No reason provided.',
					inline: true,
				},
				{ name: 'Blacklisted For', value: originalReason ?? 'Unknown', inline: true },
			)
			.setColor(colors.interchatBlue)
			.setFooter({ text: `Unblacklisted by: ${mod.username}`, iconURL: mod.displayAvatarURL() });

		await this.sendLog(hub.logChannels.modLogs, embed);
	}
}

export class JoinLeaveLogger extends HubLoggerService {
	async logServerJoin(
		hubId: string,
		server: Guild,
		opt?: { totalConnections: number; hubName: string },
	) {
		const hub = await this.fetchHub(hubId);
		if (!hub?.logChannels?.joinLeaves) return;

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

		await this.sendLog(hub?.logChannels?.joinLeaves, embed);
	}

	async logServerLeave(hubId: string, server: Guild) {
		const hub = await this.fetchHub(hubId);
		if (!hub?.logChannels?.joinLeaves) return;

		const totalConnections = await db.connectedList.count({
			where: { hubId: hub.id, connected: true },
		});
		const owner = await server.client.users.fetch(server.ownerId).catch(() => null);

		const embed = new EmbedBuilder()
			.setTitle('Server Left')
			.setDescription(
				stripIndents`
        ${emojis.dotRed} **Server:** ${server.name} (${server.id})
        ${emojis.dotRed} **Owner:** ${owner?.username} (${server.ownerId})
        ${emojis.dotRed} **Member Count:** ${server.memberCount}
      `,
			)
			.setColor('Red')
			.setThumbnail(server.iconURL())
			.setFooter({
				text: `We now have ${totalConnections} server(s) connected to ${hub.name} now!`,
			});

		this.sendLog(hub.logChannels.joinLeaves, embed);
	}
}

export class ProfanityLogger extends HubLoggerService {
	/**
   * Logs the detected profanity along with relevant details.
   * @param rawContent - The raw content containing the profanity.
   * @param author - The user who posted the content.
   * @param server - The server where the content was posted.
   */
	async log(hubId: string, rawContent: string, author: User, server: Guild) {
		const hub = await this.fetchHub(hubId);
		if (!hub?.logChannels?.profanity) return;

		const embed = new EmbedBuilder()
			.setTitle('Profanity Detected')
			.setDescription(`||${rawContent}||`)
			.setColor(colors.interchatBlue)
			.addFields({
				name: 'Details',
				value: stripIndents`
					${emojis.dotBlue} **Author:** @${author.username} (${author.id})
					${emojis.dotBlue} **Server:** ${server.name} (${server.id}})
					${emojis.dotBlue} **Hub:** ${hub.name}
				`,
			});

		await this.sendLog(hub?.logChannels?.profanity, embed);
	}
}

export class ReportLogger extends HubLoggerService {
	/**
   * Logs a report with the specified details.
   * @param userId - The ID of the user being reported.
   * @param serverId - The ID of the server being reported.
   * @param reason - The reason for the report.
   * @param reportedBy - The user who reported the incident.
   * @param evidence - Optional evidence for the report.
   */
	async log(hubId: string, { userId, serverId, reason, reportedBy, evidence }: LogReportOpts) {
		const hub = await this.fetchHub(hubId);
		if (!hub?.logChannels?.reports?.channelId) return;

		const { channelId: reportsChannelId, roleId: reportsRoleId } = hub.logChannels.reports;
		const server = await this.client.fetchGuild(serverId);
		const jumpLink = await this.genJumpLink(hubId, evidence?.messageId, reportsChannelId);

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
		await this.sendLog(reportsChannelId, embed, mentionRole);
	}

	/**
   * Retrieves the jump link for a specific message in the reports channel of a hub.
   * @param hubId - The ID of the hub.
   * @param messageId - The ID of the message. (optional)
   * @param reportsChannelId - The ID of the reports channel.
   * @returns The jump link for the specified message, or undefined if the message is not found.
   */
	async genJumpLink(hubId: string, messageId: string | undefined, reportsChannelId: string) {
		if (!messageId) return;

		const messageInDb = await db.broadcastedMessages.findFirst({
			where: { messageId },
			include: { originalMsg: { include: { broadcastMsgs: true } } },
		});

		// fetch the reports server ID from the log channel's ID
		const reportsServerId = SuperClient.resolveEval(
			await this.client.cluster.broadcastEval(
				async (cl, ctx) => {
					const channel = (await cl.channels
						.fetch(ctx.reportsChannelId)
						.catch(() => null)) as GuildTextBasedChannel | null;
					return channel?.guild.id;
				},
				{ context: { reportsChannelId } },
			),
		);

		if (messageInDb) {
			const networkChannel = await db.connectedList.findFirst({
				where: { serverId: reportsServerId, hubId },
			});
			const reportsServerMsg = messageInDb.originalMsg.broadcastMsgs.find(
				(msg) => msg.channelId === networkChannel?.channelId,
			);

			return networkChannel && reportsServerMsg
				? messageLink(networkChannel.channelId, reportsServerMsg.messageId, networkChannel.serverId)
				: undefined;
		}
	}

	public async removeReports(hubId: string) {
		await db.hubs.update({
			where: { id: hubId },
			data: { logChannels: { upsert: { set: null, update: { reports: null } } } },
		});
	}

	public async setChannelId(hubId: string, channelId: string) {
		const data = { channelId };

		await db.hubs.update({
			where: { id: hubId },
			data: {
				logChannels: {
					upsert: {
						set: { reports: data },
						update: { reports: { upsert: { set: data, update: data } } },
					},
				},
			},
		});
	}

	public async setRoleId(hub: hubs, roleId: string) {
		if (!hub?.logChannels?.reports) {
			throw new Error('Channel ID not found. Role ID cannot be set.');
		}

		const logChannels = { ...hub.logChannels, reports: { ...hub.logChannels.reports, roleId } };

		await db.hubs.update({
			where: { id: hub.id },
			data: { logChannels },
		});
	}

	public async setChannelIdAndRoleId(hubId: string, channelId: string, roleId: string) {
		const data = { reports: { channelId, roleId } };

		await db.hubs.update({
			where: { id: hubId },
			data: { logChannels: { upsert: { set: data, update: data } } },
		});
	}
}
