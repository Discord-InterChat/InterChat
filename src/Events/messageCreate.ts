import checks from '../Scripts/message/checks';
import addBadges from '../Scripts/message/addBadges';
import messageTypes from '../Scripts/message/messageTypes';
import messageContentModifiers from '../Scripts/message/messageContentModifiers';
import { APIMessage, EmbedBuilder, Message } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
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

		if (message.content.startsWith('cb!eval')) {
			require('../Scripts/message/evalScript').default.execute(message);
			return;
		}

		const db = getDb();
		const connected = await db?.connectedList.findFirst({ where: { channelId: message.channelId } });

		// ignore the message if it is not in an active network channel
		if (!connected || !db) return;
		if (!await checks.execute(message, db)) return;

		// FIXME: Make better way to get message data, because this function will be called for multiple other features in the future
		const replyInDb = await messageContentModifiers.execute(message, db);

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

		await addBadges.execute(message, db, embed);
		const attachments = await messageContentModifiers.attachmentModifiers(message, embed);

		const channelAndMessageIds: Promise<InvalidChannelId | InvalidWebhookId | APIMessage | Message<true>>[] = [];
		const allConnectedChannels = await db.connectedList.findMany({});

		const censoredEmbed = new EmbedBuilder(embed.data).setFields({ name: 'Message', value: message.censored_content });

		allConnectedChannels?.forEach((channel) => {
			const messageSendResult = messageTypes.execute(message, channel, embed, censoredEmbed, attachments, replyInDb);
			channelAndMessageIds.push(messageSendResult);
		});

		require('../Scripts/message/cleanup').default.execute(message, channelAndMessageIds);
	},
};
