import messageContentModifiers from '../Scripts/message/messageContentModifiers';
import evalScript from '../Scripts/message/evalScript';
import messageTypes from '../Scripts/message/messageTypes';
import { EmbedBuilder, GuildMember, Message, User } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
import { connectedListDocument } from '../Utils/typings/types';
import { InvalidChannelId } from '../Scripts/message/cleanup';

// TODO: edit the embed instead of changing the message content
// if guild has profanity disabled and has embeds on set the embed to normal desc :DDDDDDDDDDDDD

// TODO: Warning and timed blacklist system
// blacklist a user for a specific amount of time if they have over x warns
// might come in handy in other cases too.


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

export default {
	name: 'messageCreate',
	async execute(message: Message) {
		if (message.author.bot || blacklistsMap.has(message.author.id)) return;

		// FIXME c! on main cb
		if (message.content.startsWith('cb!eval')) evalScript.execute(message);

		// main db where ALL connected channel data is stored
		const database = getDb();
		const setup = database?.collection('setup');
		const connectedList = database?.collection('connectedList');
		const messageData = database?.collection('messageData');


		const channelInNetwork = await connectedList?.findOne({ channelId: message.channel.id });

		if (channelInNetwork) {
			// uncensored message for profanity toggle
			const oldMessage = message.content;

			const checks = await require('../Scripts/message/checks').execute(message, database);
			if (checks === false) return;

			const allConnectedChannels = connectedList?.find({});

			const embed = new EmbedBuilder()
				.setTimestamp()
				.setColor(colors())
				.addFields([{
					name: 'Message',
					value: message.content || '\u200B',
					inline: false,
				}])
				.setAuthor({
					name: message.author.tag,
					iconURL: message.author.avatarURL()?.toString(),
					url: `https://discord.com/users/${message.author.id}`,
				})
				.setFooter({
					text: `From: ${message.guild}┃${message.guild?.id}`,
					iconURL: message.guild?.iconURL()?.toString(),
				});

			await require('../Scripts/message/addBadges').execute(message, database, embed);

			await messageContentModifiers.execute(message, embed);
			const attachments = await messageContentModifiers.attachmentModifiers(message, embed);

			// leveling system
			// FIXME: Add levelling back when ready
			// require('../Scripts/message/levelling').execute(message);

			const channelAndMessageIds: Promise<Message | InvalidChannelId | undefined>[] = [];

			allConnectedChannels?.forEach(channelObj => {
				// sending the messages to the connected channels
				const msg = messageTypes.execute(message, oldMessage, channelObj as connectedListDocument, embed, setup, attachments);
				// push the entire promise, as we dont want to wait for it inside the loop
				channelAndMessageIds.push(msg);
			}).then(() => require('../Scripts/message/cleanup').default.execute(message, channelAndMessageIds, messageData, connectedList));
		}
		else {
			return;
		}
	},
};
