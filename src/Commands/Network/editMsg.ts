import { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, ApplicationCommandType, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, WebhookClient, EmbedBuilder, GuildTextBasedChannel } from 'discord.js';
import { networkMsgUpdate } from '../../Scripts/networkLogs/networkMsgUpdate';
import { constants } from '../../Utils/functions/utils';
import { prisma } from '../../Utils/db';
import wordFiler from '../../Utils/functions/wordFilter';
import logger from '../../Utils/logger';

export default {
	data: new ContextMenuCommandBuilder()
		.setName('Edit Message')
		.setType(ApplicationCommandType.Message),

	/** Edit messages throughout the network *(partially works for compact mode) */
	async execute(interaction: MessageContextMenuCommandInteraction) {
		const target = interaction.targetMessage;

		if (!await constants.topgg.hasVoted(interaction.user.id)) {
			interaction.reply({
				content: `${interaction.client.emoji.normal.no} You must [vote](https://top.gg/bot/769921109209907241/vote) to use this command.`,
				ephemeral: true,
			});
			return;
		}

		const messageInDb = await prisma.messageData.findFirst({
			where: {
				channelAndMessageIds: {
					some: {
						messageId: {
							equals: target.id,
						},
					},
				},
			},
		});

		if (messageInDb?.expired) {
			await interaction.reply({
				content: 'This message has expired :(',
				ephemeral: true,
			});
			return;
		}

		if (interaction.user.id != messageInDb?.authorId) {
			await interaction.reply({ content: 'You are not the author of this message.', ephemeral: true });
			return;
		}

		const replyRegex = /> .*/g;
		const placeholder = target.embeds[0]?.fields[0]?.value || target.content.replace(`**${interaction.user.tag}:**`, '');

		const modal = new ModalBuilder()
			.setCustomId(interaction.id)
			.setTitle('Edit Message')
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>().addComponents(
					new TextInputBuilder()
						.setRequired(true)
						.setCustomId('editMessage')
						.setStyle(TextInputStyle.Paragraph)
						.setLabel('Please enter your new message.')
						.setValue(placeholder.replace(replyRegex, '').trim())
						.setMaxLength(950),
				),
			);

		await interaction.showModal(modal);

		// TODO: Replies overrwtitten by new message :(
		interaction.awaitModalSubmit({ filter: (i) => i.user.id === interaction.user.id && i.customId === modal.data.custom_id, time: 30_000 })
			.then(i => {
				// get the input from user
				const editMessage = i.fields.getTextInputValue('editMessage');
				const censoredEditMessage = wordFiler.censor(editMessage);

				let editEmbed = new EmbedBuilder(target.embeds[0]?.toJSON());
				let censoredEmbed = new EmbedBuilder(target.embeds[0]?.toJSON());

				const reply = editEmbed?.data.fields?.at(0)?.value.match(replyRegex)?.at(0) || target.content.match(replyRegex)?.at(0);
				editEmbed?.setFields({
					name: 'Message',
					value: reply ? `${reply}\n${editMessage}` : editMessage,
				});

				censoredEmbed?.setFields({
					name: 'Message',
					value: reply ? `${reply}\n${censoredEditMessage}` : censoredEditMessage,
				});

				// loop through all the channels in the network and edit the message
				messageInDb.channelAndMessageIds.forEach(async obj => {
					//					const channelSettings = await setupList.findOne<setupDocument>({ 'channel.id': obj.channelId });
					const channelSettings = await prisma.setup.findFirst({
						where: {
							channelId: obj.channelId,
						},
					});
					const channel = await interaction.client.channels.fetch(obj.channelId) as GuildTextBasedChannel;
					const message = await channel?.messages?.fetch(obj.messageId).catch(() => null);

					if (!target.embeds[0] && message?.embeds[0]) {
						target.embeds[0] = message.embeds[0];
						editEmbed = new EmbedBuilder(message.embeds[0].toJSON()).setFields({
							name: 'Message',
							value: reply ? `${reply}\n${editMessage}` : editMessage,
						});
						censoredEmbed = new EmbedBuilder(message.embeds[0].toJSON()).setFields({
							name: 'Message',
							value: reply ? `${reply}\n${censoredEditMessage}` : censoredEditMessage,
						});
					}

					const hook = channelSettings?.webhook;

					if (hook?.token && hook.id) {
						const webhook = new WebhookClient({ id: hook.id.toString(), token: hook.token.toString() });

						if (channelSettings?.compact) {
							webhook.editMessage(obj.messageId, {
								content: reply
									? `${reply}\n ${channelSettings.profFilter ? editMessage : censoredEditMessage}`
									: channelSettings.profFilter ? editMessage : censoredEditMessage,
							});
						}
						else {
							webhook.editMessage(obj.messageId, {
								files: message?.attachments.first() ? [] : [],
								embeds: channelSettings?.profFilter ? [censoredEmbed] : [editEmbed],
							});
						}
					}

					else if (channelSettings?.compact) {
						const replyFormat = `${reply}\n**${i.user.tag}:** ${channelSettings.profFilter ? censoredEditMessage : editMessage}`;
						const compactFormat = `**${i.user.tag}:** ${channelSettings.profFilter ? censoredEditMessage : editMessage}`;

						message?.edit(reply ? replyFormat : compactFormat);
					}

					else {
						message?.edit({
							files: [],
							embeds: channelSettings?.profFilter ? [censoredEmbed] : [editEmbed],
						});
					}

				});

				i.reply({ content: `${interaction.client.emoji.normal.yes} Message Edited.`, ephemeral: true });

				const newMessageObject = {
					id: target.id,
					content: editMessage,
					timestamp: target.editedAt ?? target.createdAt,
				};

				interaction.inCachedGuild() ? networkMsgUpdate(interaction.member, target, newMessageObject) : null;

			}).catch((reason) => {if (!reason.message.includes('reason: time')) logger.error(reason);});
	},
};
