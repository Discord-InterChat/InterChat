import { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, ApplicationCommandType, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ChannelType } from 'discord.js';
import { getDb, constants } from '../../Utils/functions/utils';
import { messageData } from '../../Utils/typings/types';
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

		const db = getDb();
		const messageInDb = await db?.collection('messageData').findOne({ channelAndMessageIds: { $elemMatch: { messageId: target.id } } }) as messageData | undefined;

		if (!messageInDb || messageInDb.expired) {
			interaction.reply({
				content: 'This message has expired :(',
				ephemeral: true,
			});
			return;
		}


		if (interaction.user.id != messageInDb.authorId) {
			interaction.reply({ content: 'You are not the author of this message.', ephemeral: true });
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

		// get the new message from the user via the modal
		interaction.awaitModalSubmit({ filter: (i) => i.user.id === interaction.user.id && i.customId === modal.data.custom_id, time: 30_000 })
			.then(i => {
				const editMessage = i.fields.getTextInputValue('editMessage');

				let targetEmbed = target.embeds[0]?.toJSON();
				let compactMsg: string;

				if (targetEmbed?.fields) {
					// the message being replied to
					const targetRef = targetEmbed.fields[0].value.match(replyRegex)?.at(0);

					targetEmbed.fields[0].value = targetRef ? `${targetRef}\n${editMessage}` : editMessage;
					targetEmbed.timestamp = new Date().toISOString();
				}


				// loop through all channels and fetch the messages to edit
				// and edit each one as you go
				// this might be a bit inefficient, but it's the easiest way to do it
				if (messageInDb.channelAndMessageIds) {
					messageInDb.channelAndMessageIds.forEach(async (element) => {
						await interaction.client.channels.fetch(element.channelId).then(async channel => {
							if (channel?.type !== ChannelType.GuildText) return;
							channel.messages.fetch(element.messageId)
								.then(async message => {
									if (!message.embeds[0] && !compactMsg) {
										const temp = message.content.match(replyRegex);
										compactMsg = temp ? `${temp?.at(0)}\n**${interaction.user.tag}:** ${editMessage}` : `**${interaction.user.tag}:** ${editMessage}`;
									}

									// if the message does not have an embed (i.e. its in compact mode) then edit the message content instead
									if (!message.embeds[0]) {
										message.edit({ content: compactMsg });
									}

									// First message is in compact mode but this one is not
									// then store this as targetEmbed and use that to edit the other embeded messages
									else if (!targetEmbed) {
										targetEmbed = message.embeds[0]?.toJSON();
										if (targetEmbed.fields) targetEmbed.fields[0].value = editMessage;
										message.edit({ embeds: [targetEmbed] });
									}

									else {
										message.edit({ embeds: [targetEmbed] });
									}

								}).catch(logger.error);
						}).catch(logger.error);
					});
				}
				i.reply({ content: `${interaction.client.emoji.normal.yes} Message Edited.`, ephemeral: true });
			})
			.catch(() => {return;});
	},
};