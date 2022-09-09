import { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, ApplicationCommandType, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ChannelType } from 'discord.js';
import { getDb, constants } from '../../Utils/functions/utils';
import emojis from '../../Utils/emoji.json';
import logger from '../../Utils/logger';
import { messageData } from '../../Utils/typings/types';

export default {
	data: new ContextMenuCommandBuilder()
		.setName('Edit Message')
		.setType(ApplicationCommandType.Message),
	/**
	* ⚠️Voters only⚠️
	*
    * Edit messages throughout the network *(partially works for compact mode)*
    */
	async execute(interaction: MessageContextMenuCommandInteraction) {
		const target = interaction.targetMessage;

		if (!await constants.topgg.hasVoted(interaction.user.id)) {
			interaction.reply({
				content: `${emojis.normal.no} You must vote to use this command.`,
				ephemeral: true,
			});
			return;
		}

		const db = getDb();
		const messageInDb = await db?.collection('messageData').findOne({ channelAndMessageIds: { $elemMatch: { messageId: target.id } } }) as messageData | undefined;

		if (!messageInDb) {
			interaction.reply({
				content: 'This message has expired :(',
				ephemeral: true,
			});
			return;
		}


		if (interaction.user.id != messageInDb?.authorId) {
			interaction.reply({ content: 'You are not the author of this message.', ephemeral: true });
			return;
		}


		const modal = new ModalBuilder()
			.setCustomId(Math.random().toString(36).slice(2, 7))
			.setTitle('Report')
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>().addComponents(
					new TextInputBuilder()
						.setRequired(true)
						.setCustomId('editMessage')
						.setStyle(TextInputStyle.Paragraph)
						.setLabel('Please enter your new message.')
						.setMaxLength(950),
				),
			);

		await interaction.showModal(modal);

		// get the new message from the user via the modal
		interaction.awaitModalSubmit({ filter: (i) => i.user.id === interaction.user.id && i.customId === modal.data.custom_id, time: 30_000 })
			.then(i => {
				const editMessage = i.fields.getTextInputValue('editMessage');
				let targetEmbed = target.embeds[0]?.toJSON();

				if (targetEmbed?.fields) {
					targetEmbed.fields[0].value = editMessage;
					targetEmbed.timestamp = new Date().toISOString();
				}


				// loop through all channels and fetch the messages to edit
				// and edit each one as you go
				// this might be a bit inefficient, but it's the easiest way to do it
				if (messageInDb?.channelAndMessageIds) {
					messageInDb?.channelAndMessageIds.forEach(async (element) => {
						await interaction.client.channels.fetch(element.channelId).then(async channel => {
							if (channel?.type !== ChannelType.GuildText) return;
							await channel.messages.fetch(element.messageId).then(async message => {
								// if the message does not have an embed (i.e. its in compact mode) then edit the message directly
								if (!message.embeds[0]) {
									await message.edit({ content: `**${i.user.tag}:** ${editMessage}` });
								}

								// if the message that the edit was performed on does not have an embed
								// but message in the other server does (i.e. First message is in compact mode but this one is not),
								// then store this as a new embed and edit with the new message
								else if (!targetEmbed) {
									targetEmbed = message.embeds[0]?.toJSON();
									targetEmbed.fields![0].value = editMessage;
									await message.edit({ embeds: [targetEmbed] });
								}

								else {
									message.edit({ embeds: [targetEmbed] });
								}
							}).catch(logger.error);
						}).catch(logger.error);
					});
				}
				i.reply({ content: `${emojis.normal.yes} Message Edited.`, ephemeral: true });
			});
	},
};