import modifers from '../Scripts/message/messageContentModifiers';
import evalScript from '../Scripts/message/evalScript';
import messageSendTypes from '../Scripts/message/messageTypes';
import { EmbedBuilder, GuildMember, Message, User } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
import { connectedListDocument, messageData as messageDataInterface } from '../Utils/typings/types';
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
	/** Uncensored compact message */
	cleanCompactMessage?: string,
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

			message.compactMessage = `**${message.author.tag}:** ${message.content}`;

			let messageInDb: messageDataInterface | null = null;

			if (message.reference) {
				const messageReferred = await message.fetchReference().catch(() => null);
				messageInDb = await messageData?.findOne({ channelAndMessageIds: { $elemMatch: { messageId: messageReferred?.id } } }) as messageDataInterface;

				if (messageInDb && messageReferred) {
					let embed = messageReferred.embeds[0]?.fields[0]?.value;
					let compact = messageReferred.content;

					// if the message is a reply to another reply, remove the older reply :D
					if (messageInDb.reference) {
						const replaceReply = (string: string) => {
							// if for some reason the reply got edited and the reply format (> message) is not there
							// return the original message and not undefined
							return string?.split(/> .*/g).at(-1)?.trimStart() || string;
						};

						// messages that are being replied to
						embed = replaceReply(embed);
						compact = replaceReply(compact);
					}

					embed = embed?.replaceAll('\n', '\n> ');
					compact = compact?.replaceAll('\n', '\n> ');

					message.content = `> ${embed || compact}\n${message.content}`;
					message.compactMessage = `> ${embed || compact}\n${message.compactMessage}`;
				}
			}

			const embed = new EmbedBuilder()
				.setTimestamp()
				.setColor(colors())
				.addFields([{ name: 'Message', value: message.content || '\u200B' }])
				.setAuthor({
					name: message.author.tag,
					iconURL: message.author.avatarURL() || message.author.defaultAvatarURL,
					url: `https://discord.com/users/${message.author.id}`,
				})
				.setFooter({
					text: `From: ${message.guild}┃${message.guild?.id}`,
					iconURL: message.guild?.iconURL()?.toString(),
				});


			await require('../Scripts/message/addBadges').execute(message, database, embed);
			const attachments = await modifers.attachmentModifiers(message, embed);

			const uncensoredEmbed = new EmbedBuilder(embed.data);
			message.cleanCompactMessage = message.compactMessage;

			await modifers.profanityCensor(embed, message);

			// leveling system
			// FIXME: Add levelling back when ready
			// require('../Scripts/message/levelling').execute(message);

			const channelAndMessageIds: Promise<Message | InvalidChannelId>[] = [];

			allConnectedChannels?.forEach(channelObj => {
				// sending the messages to the connected channels
				const msg = messageSendTypes.execute(message, channelObj as connectedListDocument, embed.data, uncensoredEmbed, setup, attachments, messageInDb);
				// push the entire promise, as we dont want to wait for it inside the loop
				channelAndMessageIds.push(msg);
			}).then(async () => require('../Scripts/message/cleanup').default.execute(message, channelAndMessageIds, messageData, connectedList));
		}
		else {
			return;
		}
	},
};
