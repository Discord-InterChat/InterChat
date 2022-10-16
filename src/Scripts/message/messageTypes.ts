import { EmbedBuilder, AttachmentBuilder, Message, TextChannel, MessageMentionTypes, BaseMessageOptions } from 'discord.js';
import { Collection } from 'mongodb';
import { connectedListDocument, setupDocument } from '../../Utils/typings/types';

interface WebhookMessageInterface extends BaseMessageOptions {
	content: string,
	username: string,
	files?: AttachmentBuilder[],
	avatarURL: string,
	allowedMentions: { parse: MessageMentionTypes[] },
}

export default {
	/**
	 * Converts a message to embeded or normal depending on the server settings.
	 *
	 * @param uncensoredMessage The uncensored, original message.
	 * */
	execute: async (message: Message, uncensoredMessage: string, channelObj: connectedListDocument, embed: EmbedBuilder, setupDb?: Collection, attachments?: AttachmentBuilder) => {
		const allChannel = message.client.channels.cache.get(channelObj.channelId) as TextChannel;

		if (!allChannel) return { unknownChannelId: channelObj.channelId };

		const channelInDB = await setupDb?.findOne({ 'channel.id': allChannel.id }) as setupDocument | null | undefined;

		if (channelInDB?.profFilter === false) {
			embed = new EmbedBuilder(embed.data).setFields({ name: embed.data.fields?.at(0)?.name || 'Message', value: `${uncensoredMessage}` });
		}

		if (channelInDB?.compact === true && allChannel.id == message.channel.id) {
			return webhookAutomate(message.channel as TextChannel);
		}
		else if (channelInDB?.compact === true && allChannel.id == channelInDB.channel.id) {
			return webhookAutomate(allChannel);
		}
		// TODO: Make sending images a voter only feature, so that random people won't send inappropriate images
		else if (attachments) {
			return await allChannel.send({ embeds: [embed], files: [attachments], allowedMentions: { parse: ['roles'] } });
		}

		else {
			return await allChannel.send({ embeds: [embed], allowedMentions: { parse: ['roles'] } });
		}


		async function webhookAutomate(chan: TextChannel) {
			const webhookMessage: WebhookMessageInterface = {
				content: message.content,
				username: message.author.username,
				avatarURL: String(message.author.avatarURL()),
				allowedMentions: { parse: [] },
			};

			const normalMessage: BaseMessageOptions = {
				content: `**${message.author.tag}:** ${message.content}`,
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
			catch (error: any) {
				allChannel.send(`${message.client.emoji.normal.no} Unable to send webhook message! \n**Error:** ${error.message}`);
			}
		}
	},
};