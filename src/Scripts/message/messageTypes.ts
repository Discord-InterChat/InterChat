import { EmbedBuilder, AttachmentBuilder, TextChannel, MessageMentionTypes, BaseMessageOptions, APIEmbed } from 'discord.js';
import { Collection } from 'mongodb';
import { MessageInterface } from '../../Events/messageCreate';
import { connectedListDocument, messageData, setupDocument } from '../../Utils/typings/types';

interface WebhookMessageInterface extends BaseMessageOptions {
	username: string,
	files?: AttachmentBuilder[],
	avatarURL: string,
	allowedMentions: { parse: MessageMentionTypes[] },
}

export default {
	/**
	 * Converts a message to embeded or normal depending on the server settings.
	 *
	 * @param uncensoredEmbed An embed with the original message content. (uncensored)
	 */
	execute: async (
		message: MessageInterface,
		channel: connectedListDocument,
		embedData: APIEmbed,
		uncensoredEmbed: EmbedBuilder,
		setupDb: Collection | undefined,
		attachments: AttachmentBuilder | undefined,
		referenceMessages: messageData | null,
	) => {
		const channelObj = await message.client.channels.fetch(channel.channelId).catch(() => null) as TextChannel | null;
		if (!channelObj) return { unknownChannelId: channel.channelId };

		const embed = new EmbedBuilder(embedData);
		const channelInDB = await setupDb?.findOne({ 'channel.id': channelObj.id }) as setupDocument | null | undefined;


		if (referenceMessages) {
			const msgInDb = referenceMessages.channelAndMessageIds.find((dbmsg) => dbmsg.channelId === channelObj.id);
			if (msgInDb) embed.setDescription(`[${message.client.emoji.icons.info}](https://discord-chatbot.gitbook.io/chatbot/guide/network/replying-to-a-message) [Jump To Message](https://discord.com/channels/${channelObj.guildId}/${msgInDb?.channelId}/${msgInDb?.messageId})`);
		}


		if (channelInDB?.compact === true) {
			return sendCompact(channelObj);
		}
		else {
			// TODO: Make sending images a voter only feature, so that random people won't send inappropriate images
			return await channelObj.send({
				embeds: [channelInDB?.profFilter === true ? embed : uncensoredEmbed],
				files: attachments ? [attachments] : [],
				allowedMentions: { parse: ['roles'] },
			});
		}


		async function sendCompact(compactChannel: TextChannel) {
			const content = channelInDB?.profFilter === true ? message.compactMessage : message.cleanCompactMessage;

			const webhookMessage: WebhookMessageInterface = {
				content,
				username: message.author.username,
				files: attachments ? [attachments] : [],
				avatarURL: message.author.avatarURL() || message.author.defaultAvatarURL,
				allowedMentions: { parse: [] },
			};

			const normalMessage: BaseMessageOptions = {
				content,
				files: attachments ? [attachments] : [],
				allowedMentions: { parse: [] },
			};

			try {
				const webhooks = await compactChannel.fetchWebhooks();
				const webhook = webhooks.first();
				if (webhook) return await webhook.send(webhookMessage);

				return await compactChannel.send(normalMessage);
			}
			catch {
				return await compactChannel.send(normalMessage);
			}
		}
	},
};