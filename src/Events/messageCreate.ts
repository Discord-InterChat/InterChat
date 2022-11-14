import checks from '../Scripts/message/checks';
import { APIMessage, EmbedBuilder, Message } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
import { connectedListDocument, messageData as messageDataDocument } from '../Utils/typings/types';
import { InvalidChannelId, InvalidWebhookId } from '../Scripts/message/cleanup';

export interface MessageInterface extends Message<boolean>{
	compact_message: string,
	censored_compact_message: string,
	censored_content: string,
}

export default {
	name: 'messageCreate',
	async execute(message: MessageInterface) {
		if (message.author.bot || message.webhookId) return;

		if (message.content.startsWith('c!eval')) {
			require('../Scripts/message/evalScript').default.execute(message);
			return;
		}

		const db = getDb();
		const connectedList = db?.collection<connectedListDocument>('connectedList');
		const connected = await connectedList?.findOne({ channelId: message.channelId });

		// ignore the message if it is not in an active network channel
		if (!connected || !db) return;
		const messageData = db?.collection<messageDataDocument>('messageData');

		// run the message through checks
		if (!await checks.execute(message, db)) return;

		// FIXME: Make better way to get message data, because this function will be called for multiple other features in the future
		const replyInDb = await require('../Scripts/message/messageContentModifiers').execute(message, messageData);

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
				text: `From: ${message.guild}`,
				iconURL: message.guild?.iconURL()?.toString(),
			});

		await require('../Scripts/message/addBadges').execute(message, db, embed);
		const attachments = await require('../Scripts/message/messageContentModifiers').attachmentModifiers(message, embed);

		const channelAndMessageIds: Promise<InvalidChannelId | InvalidWebhookId | APIMessage | Message<true>>[] = [];
		const allConnectedChannels = connectedList?.find({});

		allConnectedChannels?.forEach((channel) => {
			const messageSendResult = require('../Scripts/message/messageTypes').execute(message, channel, embed, attachments, replyInDb);
			channelAndMessageIds.push(messageSendResult);
		}).then(() => require('../Scripts/message/cleanup').default.execute(message, channelAndMessageIds));

	},
};
