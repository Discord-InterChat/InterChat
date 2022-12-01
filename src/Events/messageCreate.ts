import checks from '../Scripts/message/checks';
import addBadges from '../Scripts/message/addBadges';
import messageTypes from '../Scripts/message/messageTypes';
import messageContentModifiers from '../Scripts/message/messageContentModifiers';
import { APIMessage, EmbedBuilder, Message } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
import cleanup, { InvalidChannelId, InvalidWebhookId } from '../Scripts/message/cleanup';

export interface MessageInterface extends Message<boolean>{
	compact_message: string,
	censored_compact_message: string,
	censored_content: string,
}

export default {
	name: 'messageCreate',
	async execute(message: MessageInterface) {
		if (message.author.bot || message.webhookId) return;

		const db = getDb();
		const connected = await db?.connectedList.findFirst({ where: { channelId: message.channelId } });

		// ignore the message if it is not in an active network channel
		if (!connected || !await checks.execute(message, db)) return;

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


		// Get data message being replied to from the db (for jump buttons)
		const replyInDb = await messageContentModifiers.appendReply(message, db);
		// define censored properties to message class (message.censored_xxxx)
		await messageContentModifiers.execute(message);

		const censoredEmbed = new EmbedBuilder(embed.data).setFields({ name: 'Message', value: message.censored_content || '\u200B' });
		const attachments = await messageContentModifiers.attachmentModifiers(message, embed, censoredEmbed);
		await addBadges.execute(message, db, embed, censoredEmbed);


		const channelAndMessageIds: Promise<InvalidChannelId | InvalidWebhookId | APIMessage | Message<true>>[] = [];
		const allConnectedChannels = await db.connectedList.findMany();

		// send the message to all connected channels in apropriate format (webhook/compact/normal)
		allConnectedChannels?.forEach((channel) => {
			const messageSendResult = messageTypes.execute(message, channel, embed, censoredEmbed, attachments, replyInDb);
			channelAndMessageIds.push(messageSendResult);
		});

		// delete unknown channels & insert message into messageData collection for future use
		cleanup.execute(message, channelAndMessageIds);
	},
};