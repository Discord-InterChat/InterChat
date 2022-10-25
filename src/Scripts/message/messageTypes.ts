import { EmbedBuilder, AttachmentBuilder, TextChannel, MessageMentionTypes, BaseMessageOptions } from 'discord.js';
import { Collection } from 'mongodb';
import { MessageInterface } from '../../Events/messageCreate';
import { connectedListDocument, setupDocument } from '../../Utils/typings/types';

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
	execute: async (message: MessageInterface, channelObj: connectedListDocument, embed: EmbedBuilder, uncensoredEmbed: EmbedBuilder, setupDb?: Collection, attachments?: AttachmentBuilder) => {
		const allChannel = message.client.channels.cache.get(channelObj.channelId) as TextChannel;

		if (!allChannel) return { unknownChannelId: channelObj.channelId };

		const channelInDB = await setupDb?.findOne({ 'channel.id': allChannel.id }) as setupDocument | null | undefined;

		if (!channelInDB?.profFilter) {
			message.compactMessage = String(message.uncensoredCompactMessage);
			embed = uncensoredEmbed;
		}

		if (channelInDB?.compact === true && allChannel.id == message.channel.id) {
			return sendCompact(message.channel as TextChannel);
		}
		else if (channelInDB?.compact === true && allChannel.id == channelInDB.channel.id) {
			return sendCompact(allChannel);
		}
		// TODO: Make sending images a voter only feature, so that random people won't send inappropriate images
		else if (attachments) {
			return await allChannel.send({ embeds: [embed], files: [attachments], allowedMentions: { parse: ['roles'] } });
		}

		else {
			return await allChannel.send({ embeds: [embed], allowedMentions: { parse: ['roles'] } });
		}


		async function sendCompact(chan: TextChannel) {
			const webhookMessage: WebhookMessageInterface = {
				content: message.compactMessage,
				username: message.author.username,
				avatarURL: String(message.author.avatarURL()),
				allowedMentions: { parse: [] },
			};

			const normalMessage: BaseMessageOptions = {
				content: message.compactMessage,
				allowedMentions: { parse: [] },
			};


			if (attachments) {
				webhookMessage.files = [attachments];
				normalMessage.files = [attachments];
			}

			try {
				const webhooks = await chan.fetchWebhooks();
				const webhook = webhooks.first();

				if (!webhook) return await allChannel.send(normalMessage);
				else return await webhook.send(webhookMessage);
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			catch {
				return await allChannel.send(normalMessage);
			}
		}
	},
};