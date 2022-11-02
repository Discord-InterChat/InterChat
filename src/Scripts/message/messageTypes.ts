import { EmbedBuilder, AttachmentBuilder, TextChannel, BaseMessageOptions, ActionRowBuilder, ButtonBuilder, ButtonStyle, WebhookClient, WebhookCreateMessageOptions } from 'discord.js';
import { Collection } from 'mongodb';
import { MessageInterface } from '../../Events/messageCreate';
import logger from '../../Utils/logger';
import { connectedListDocument, messageData, setupDocument } from '../../Utils/typings/types';


export default {
	/**
	 * Converts a message to embeded or normal depending on the server settings.
	 *
	 * @param uncensoredEmbed An embed with the original message content. (uncensored)
	 */
	execute: async (
		message: MessageInterface,
		channel: connectedListDocument,
		embed: EmbedBuilder,
		uncensoredEmbed: EmbedBuilder,
		setupDb: Collection<setupDocument> | undefined,
		attachments: AttachmentBuilder | undefined,
		referenceMessage: messageData | null,
	) => {
		const channelObj = await message.client.channels.fetch(channel.channelId).catch(() => null) as TextChannel | null;
		if (!channelObj) return { unknownChannelId: channel.channelId };

		const channelInDB = await setupDb?.findOne({ 'channel.id': channelObj.id });
		let replyButton: ActionRowBuilder<ButtonBuilder> | undefined;
		let webhook: WebhookClient | undefined;

		if (referenceMessage) {
			const msgInDb = referenceMessage.channelAndMessageIds.find((dbmsg) => dbmsg.channelId === channelObj.id);
			replyButton = new ActionRowBuilder<ButtonBuilder>()
				.addComponents(
					new ButtonBuilder()
						.setLabel('Jump To Message')
						.setStyle(ButtonStyle.Link)
						.setURL(`https://discord.com/channels/${channelObj.guildId}/${msgInDb?.channelId}/${msgInDb?.messageId}`),
				);
		}


		if (channelInDB?.webhook) webhook = new WebhookClient({ id: channelInDB.webhook.id, token: channelInDB.webhook.token });

		// send the message
		if (channelInDB?.compact === true) return await sendCompact(channelObj);
		else return await sendNormal(channelObj);


		async function sendNormal(destination: TextChannel) {
			const webhookEmbed = embed.toJSON();
			const uncensoredWebhookEmbed = uncensoredEmbed.toJSON();

			webhookEmbed.author = undefined;
			uncensoredWebhookEmbed.author = undefined;

			webhookEmbed.footer = { text: `${message.guild?.name}`, icon_url: message.guild?.iconURL() || undefined };
			uncensoredWebhookEmbed.footer = { text: `${message.guild?.name}`, icon_url: message.guild?.iconURL() || undefined };


			const webhookMessage: WebhookCreateMessageOptions = {
				embeds: [channelInDB?.profFilter === true ? webhookEmbed : uncensoredWebhookEmbed],
				files: attachments ? [attachments] : [],
				components: replyButton ? [replyButton] : [],
				avatarURL: message.author.avatarURL() || message.author.defaultAvatarURL,
				username: message.author.username,
				allowedMentions: { parse: ['roles'] },
			};

			const normalMessage: BaseMessageOptions = {
				embeds: [channelInDB?.profFilter === true ? embed : uncensoredEmbed],
				files: attachments ? [attachments] : [],
				components: replyButton ? [replyButton] : [],
				allowedMentions: { parse: ['roles'] },
			};

			try {
				if (webhook) return await webhook.send(webhookMessage);
				return await destination.send(normalMessage);
			}
			catch {
				destination.send(normalMessage).catch(logger.error);
				return { unknownWebhookId: channelInDB?.webhook?.id };
			}
		}

		async function sendCompact(compactChannel: TextChannel) {
			const content = channelInDB?.profFilter === true ? message.censoredCompactMessage : message.compactMessage;

			const webhookMessage: WebhookCreateMessageOptions = {
				content: content?.replaceAll(`**${message.author.tag}:**`, ''),
				username: message.author.username,
				files: attachments ? [attachments] : [],
				components: replyButton ? [replyButton] : [],
				avatarURL: message.author.avatarURL() || message.author.defaultAvatarURL,
				allowedMentions: { parse: [] },
			};

			const normalMessage: BaseMessageOptions = {
				content,
				files: attachments ? [attachments] : [],
				components: replyButton ? [replyButton] : [],
				allowedMentions: { parse: [] },
			};

			try {
				if (webhook) return await webhook.send(webhookMessage);
				return await compactChannel.send(normalMessage);
			}
			catch {
				return await compactChannel.send(normalMessage);
			}
		}
	},
};