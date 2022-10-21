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

export default {
	name: 'messageCreate',
	async execute(message: Message) {
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

			if (message.reference) {
				const referredMessage = await message.fetchReference();
				if (
					referredMessage.author.id === message.client.user.id &&
					referredMessage.embeds[0] &&
					referredMessage.embeds[0].fields?.length > 0
				) {
					message.content = `> ${referredMessage.embeds[0].fields[0].value}\n${message.content}`;
				}
			}

			const embed = new EmbedBuilder()
				.setTimestamp()
				.setColor(colors())
				.addFields([{ name: 'Message', value: message.content }])
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

			const modifers = require('../Scripts/message/messageContentModifiers').default;
			const attachments = await modifers.attachmentModifiers(message, embed);

			// this embed remains untouched and is not changed in embedModifers
			// required for profanity toggle
			const uncensoredEmbed = new EmbedBuilder(embed.data);

			// call this function after uncensoredEmbed is created or it will be modified
			await modifers.embedModifers(embed);

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
