import modifers from '../Scripts/message/messageContentModifiers';
import evalScript from '../Scripts/message/evalScript';
import messageSendTypes from '../Scripts/message/messageTypes';
import { EmbedBuilder, GuildMember, Message, User } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
import { connectedListDocument } from '../Utils/typings/types';
import { InvalidChannelId } from '../Scripts/message/cleanup';
import { Collection } from 'mongodb';

type UserEntries = {
	msgCount: number,
	slowMsgCount: number,
	lastMessage : Message,
	timer : NodeJS.Timeout,
}

type BlacklistEntries = {
	user: GuildMember | User,
	timer: NodeJS.Timeout
}

type WarningEntries = {
	warnCount: number,
	timer: NodeJS.Timeout
}

export const usersMap = new Map<string, UserEntries>();
export const blacklistsMap = new Map<string, BlacklistEntries>();
export const warningsMap = new Map<string, WarningEntries>();

export interface MessageInterface extends Message<boolean>{
	compactMessage?: string,
	uncensoredCompactMessage?: string,
}

export default {
	name: 'messageCreate',
	async execute(message: MessageInterface) {
		if (message.author.bot || blacklistsMap.has(message.author.id)) return;

		if (message.content.startsWith('c!eval')) evalScript.execute(message);

		// main db where ALL connected channel data is stored
		const database = getDb();
		const setup = database?.collection('setup');
		const connectedList = database?.collection('connectedList') as Collection<connectedListDocument> | undefined;
		const messageData = database?.collection('messageData');


		const channelInNetwork = await connectedList?.findOne({ channelId: message.channel.id });

		if (channelInNetwork) {
			const allConnectedChannels = connectedList?.find({});
			const checks = await require('../Scripts/message/checks').execute(message, database);
			if (!checks) return;

			const embed = new EmbedBuilder()
				.setTimestamp()
				.setColor(colors())
				.addFields([{ name: 'Message', value: message.content || '\u200B' }])
				.setAuthor({
					name: message.author.tag,
					iconURL: message.author.avatarURL()?.toString(),
					url: `https://discord.com/users/${message.author.id}`,
				})
				.setFooter({
					text: `From: ${message.guild}┃${message.guild?.id}`,
					iconURL: message.guild?.iconURL()?.toString(),
				});

			message.compactMessage = `**${message.author.tag}:** ${message.content}`;

			if (message.reference) {
				const messageReferred = await message.fetchReference().catch(() => null);
				const messageInDb = await messageData?.findOne({ channelAndMessageIds: { $elemMatch: { messageId: messageReferred?.id } } });

				if (messageInDb && messageReferred) {
					let embedMessage = messageReferred.embeds[0]?.fields[0]?.value;
					const embedFieldName = messageReferred.embeds[0]?.fields[0]?.name;

					const compactReferrence = messageReferred.content;

					if (embedFieldName?.includes('Reply Message') && embedMessage) embedMessage = embedMessage?.split(/> .*/g)[1].trimStart();

					message.content = embedMessage ? `> ${embedMessage}\n${message.content}` : compactReferrence ? `> ${compactReferrence}\n${message.content}` : message.content;
					message.compactMessage = embedMessage ? `> ${embedMessage}\n` + message.compactMessage : compactReferrence ? `> ${compactReferrence}\n` + message.compactMessage : message.content;

					embed.spliceFields(0, 1, {
						name: 'Reply Message',
						value: message.content,
					});
				}
			}


			await require('../Scripts/message/addBadges').execute(message, database, embed);
			const attachments = await modifers.attachmentModifiers(message, embed);

			const uncensoredEmbed = new EmbedBuilder(embed.data);
			message.uncensoredCompactMessage = message.compactMessage;

			await modifers.profanityCensor(embed, message); // FIXME: Does not work for compact messages

			// leveling system
			// FIXME: Add levelling back when ready
			// require('../Scripts/message/levelling').execute(message);

			const channelAndMessageIds: Promise<Message | InvalidChannelId>[] = [];

			allConnectedChannels?.forEach(channelObj => {
				// sending the messages to the connected channels
				const msg = messageSendTypes.execute(message, channelObj as connectedListDocument, embed, uncensoredEmbed, setup, attachments);
				// push the entire promise, as we dont want to wait for it inside the loop
				channelAndMessageIds.push(msg);
			}).then(async () => require('../Scripts/message/cleanup').default.execute(message, channelAndMessageIds, messageData, connectedList));
		}
		else {
			return;
		}
	},
};
