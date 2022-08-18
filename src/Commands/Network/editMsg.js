const { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, ApplicationCommandType, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { getDb, topgg } = require('../../utils/functions/utils');
const emojis = require('../../utils/emoji.json');
const logger = require('../../utils/logger');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('Edit Message')
		.setType(ApplicationCommandType.Message),
	/**
	* ⚠️Voters only⚠️
	*
    * Edit messages throughout the network *(partially works for compact mode)*
    * @param {MessageContextMenuCommandInteraction} interaction
    */
	async execute(interaction) {
		const target = interaction.targetMessage;

		if (!await topgg.hasVoted(interaction.user.id)) {
			interaction.reply({
				content: `${emojis.normal.no} You must vote to use this command.`,
				ephemeral: true,
			});
			return;
		}

		const db = getDb();
		const messageInDb = await db.collection('messageData').find({ channelAndMessageIds: { $elemMatch: { messageId: target.id } } }).toArray();

		if (messageInDb.length === 0) {
			interaction.reply({
				content: 'This message has expired :(',
				ephemeral: true,
			});
			return;
		}


		if (interaction.user.id != messageInDb[0].authorId) {
			interaction.reply({ content: 'You are not the author of this message.', ephemeral: true });
			return;
		}


		const modal = new ModalBuilder()
			.setCustomId(Math.random().toString(36).slice(2, 7))
			.setTitle('Report')
			.addComponents(
				new ActionRowBuilder().addComponents(
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
		const filter = (i) => i.user.id === interaction.user.id && i.customId === modal.data.custom_id;
		interaction.awaitModalSubmit({ filter, time: 30_000 })
			.catch(() => {return;})
			.then(i => {
				const editMessage = i.fields.getTextInputValue('editMessage');
				let targetEmbed = target.embeds[0]?.toJSON();

				if (targetEmbed) {
					targetEmbed.fields[0].value = editMessage;
					targetEmbed.timestamp = new Date().toISOString();
				}


				// loop through all channels and fetch the messages to edit
				// and edit each one as you go
				// this might be a bit inefficient, but it's the easiest way to do it
				if (messageInDb[0].channelAndMessageIds) {
					messageInDb[0].channelAndMessageIds.forEach(async element => {
						await interaction.client.channels.fetch(element.channelId).then(async channel => {
							await channel.messages.fetch(element.messageId).then(async message => {
								// if the message does not have an embed (i.e. its in compact mode) then edit the message directly
								if (!message.embeds[0]) {
									await message.edit({ content: editMessage });
								}

								// if the FIRST message (message that the edit was performed on) does not have an embed
								// but message in the other server does (i.e. First message is in compact mode but this one is not),
								// then store this as a new embed and edit with the new message
								else if (!targetEmbed) {
									targetEmbed = message.embeds[0].toJSON();
									targetEmbed.fields[0].value = editMessage;
								}
								await message.edit({ embeds: [targetEmbed] });
							}).catch(logger.error);
						}).catch(logger.error);
					});
				}
				i.reply({ content: `${emojis.normal.yes} Message Edited.`, ephemeral: true });
			});
	},
};