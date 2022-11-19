import logger from '../../Utils/logger';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, GuildTextBasedChannel, WebhookClient, WebhookCreateMessageOptions } from 'discord.js';
import { MessageInterface } from '../../Events/messageCreate';
import { getDb } from '../../Utils/functions/utils';
import { InvalidChannelId, InvalidWebhookId } from './cleanup';
import { connectedList, messageData } from '@prisma/client';

export = {
	execute: async (
		message: MessageInterface,
		channel: connectedList,
		embed: EmbedBuilder,
		censoredEmbed: EmbedBuilder,
		attachments: AttachmentBuilder | undefined,
		replyData: messageData | null | undefined,
	) => {
		const db = getDb();
		const channelInSetup = await db?.setup?.findFirst({ where: { channelId: channel?.channelId } });
		const channelToSend = await message.client.channels.fetch(channel.channelId).catch(() => null) as GuildTextBasedChannel | null;

		if (!channelToSend) return { unkownChannelId: channel?.channelId } as InvalidChannelId;

		const replyInDb = replyData?.channelAndMessageIds.find((msg) => msg.channelId === channel.channelId);
		const replyButton = replyInDb
			? new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
				.setLabel('Jump')
				.setStyle(ButtonStyle.Link)
				.setURL(`https://discord.com/channels/${channelToSend.guildId}/${replyInDb.channelId}/${replyInDb.messageId}`))
			: null;


		if (channelInSetup?.webhook) {
			const webhook = new WebhookClient({ id: `${channelInSetup?.webhook?.id}`, token: `${channelInSetup?.webhook?.token}` });

			const webhookMessage: WebhookCreateMessageOptions = {
				username: message.author.username,
				avatarURL: message.author.avatarURL() || message.author.defaultAvatarURL,
				files: attachments ? [attachments] : [],
				components: replyButton ? [replyButton] : [],
				allowedMentions: { parse: ['roles', 'everyone'] },
			};

			channelInSetup?.compact
				? webhookMessage.content = channelInSetup?.profFilter ? message.censored_content : message.content
				: webhookMessage.embeds = [channelInSetup?.profFilter ? censoredEmbed : embed];

			try {
				return await webhook.send(webhookMessage);
			}
			catch (e) {
				logger.error(e);
				return { unknownWebhookId: webhook.id } as InvalidWebhookId;
			}
		}

		else if (channelInSetup?.compact) {
			try {
				return await channelToSend.send({
					content: channelInSetup?.profFilter ? message.censored_compact_message : message.compact_message,
					components: replyButton ? [replyButton] : [],
					files: attachments ? [attachments] : [],
				});
			}
			catch (e) {
				logger.error(e);
				return { unknownChannelId: channelToSend.id } as InvalidChannelId;
			}
		}

		else {
			try {
				return await channelToSend.send({
					embeds: [channelInSetup?.profFilter ? censoredEmbed : embed],
					files: attachments ? [attachments] : [],
					components: replyButton ? [replyButton] : [],
					allowedMentions: { parse: ['roles', 'everyone'] },
				});
			}
			catch (e) {
				logger.error(e);
				return { unknownChannelId: channelToSend.id } as InvalidChannelId;
			}
		}
	},
};