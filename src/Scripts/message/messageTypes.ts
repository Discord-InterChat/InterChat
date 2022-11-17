import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, GuildTextBasedChannel, WebhookClient } from 'discord.js';
import { MessageInterface } from '../../Events/messageCreate';
import { getDb } from '../../Utils/functions/utils';
import { InvalidChannelId, InvalidWebhookId } from './cleanup';
import logger from '../../Utils/logger';
import { connectedList, messageData } from '@prisma/client';

export = {
	execute: async (
		message: MessageInterface,
		channel: connectedList,
		embed: EmbedBuilder,
		attachments: AttachmentBuilder | undefined,
		replyData: messageData | null | undefined,
	) => {
		const db = getDb();
		const channelInSetup = await db?.setup?.findFirst({ where: { channelId: channel?.channelId } });
		const channelToSend = await message.client.channels.fetch(channel.channelId).catch(() => null) as GuildTextBasedChannel | null;

		if (!channelToSend) return { unkownChannelId: channel?.channelId } as InvalidChannelId;

		const replyInDb = replyData?.channelAndMessageIds.find((msg) => msg.channelId === channel.channelId);
		const replyButton = replyInDb ?
			new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
				.setLabel('Jump')
				.setStyle(ButtonStyle.Link)
				.setURL(`https://discord.com/channels/${channelToSend.guildId}/${replyInDb.channelId}/${replyInDb.messageId}`))
			: null;


		if (channelInSetup?.webhook) return await sendWebhook();
		else if (channelInSetup?.compact) return await sendCompact(channelToSend);
		else return await sendEmbed(channelToSend);

		async function sendCompact(destination: GuildTextBasedChannel) {
			try {
				return await destination.send({
					content: channelInSetup?.profFilter ? message.censored_compact_message : message.compact_message,
					components: replyButton ? [replyButton] : [],
					files: attachments ? [attachments] : [],
				});
			}
			catch (e) {
				logger.error(e);
				return { unknownChannelId: destination.id } as InvalidChannelId;
			}
		}
		async function sendEmbed(destination: GuildTextBasedChannel) {
			const censoredEmbed = new EmbedBuilder(embed.data).setFields({ name: 'Message', value: message.censored_content || '\u200B' });

			try {
				return await destination.send({
					embeds: [channelInSetup?.profFilter ? censoredEmbed : embed],
					files: attachments ? [attachments] : [],
					components: replyButton ? [replyButton] : [],
					allowedMentions: { parse: ['roles', 'everyone'] },
				});
			}
			catch (e) {
				logger.error(e);
				return { unknownChannelId: destination.id } as InvalidChannelId;
			}
		}
		async function sendWebhook() {
			const webhook = new WebhookClient({ id: `${channelInSetup?.webhook?.id}`, token: `${channelInSetup?.webhook?.token}` });
			const WebhookEmbed = new EmbedBuilder(embed.data)
				.setFooter({ text: `${message.guild?.name}`, iconURL: message.guild?.iconURL() || undefined });
			const censoredEmbed = new EmbedBuilder(WebhookEmbed.data)
				.setFields({ name: 'Message', value: message.censored_content });

			try {
				if (channelInSetup?.compact) {
					return await webhook.send({
						username: message.author.username,
						avatarURL: message.author.avatarURL() || message.author.defaultAvatarURL,
						content: channelInSetup?.profFilter ? message.censored_content : message.content,
						files: attachments ? [attachments] : [],
						components: replyButton ? [replyButton] : [],
						allowedMentions: { parse: ['roles', 'everyone'] },
					});
				}
				else {
					return await webhook.send({
						username: message.author.username,
						avatarURL: message.author.avatarURL() || message.author.defaultAvatarURL,
						embeds: [channelInSetup?.profFilter ? censoredEmbed : WebhookEmbed],
						files: attachments ? [attachments] : [],
						components: replyButton ? [replyButton] : [],
						allowedMentions: { parse: ['roles', 'everyone'] },
					});
				}
			}
			catch (e) {
				logger.error(e);
				return { unknownWebhookId: webhook.id } as InvalidWebhookId;
			}
		}
	},
};