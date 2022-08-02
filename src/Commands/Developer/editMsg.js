const { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, ApplicationCommandType, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getDb } = require('../../utils/functions/utils');
const logger = require('../../utils/logger');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('Edit Message')
		.setType(ApplicationCommandType.Message),
	/**
         *
         * @param {MessageContextMenuCommandInteraction} interaction
         */
	async execute(interaction) {
		const target = interaction.targetMessage;
		const db = getDb();
		const messageInDb = await db.collection('messageData').find({ channelAndMessageIds: { $elemMatch: { messageId: target.id } } }).toArray();

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

		const filter = (i) => i.user.id === interaction.user.id && i.customId === modal.data.custom_id;
		interaction.awaitModalSubmit({ filter, time: 30_000 })
			.catch(() => {return;}) // TODO: this probably fixes the modal issues in other files as well! So, do the same there :D
			.then(i => {
				if (i === undefined) return;
				const targetEmbed = target.embeds[0].toJSON();
				const editMessage = i?.fields.getTextInputValue('editMessage');

				targetEmbed.fields[0].value = editMessage;
				targetEmbed.timestamp = new Date().toISOString();


				if (messageInDb[0].channelAndMessageIds) {
					messageInDb[0].channelAndMessageIds.forEach(async element => {
						await interaction.client.channels.fetch(element.channelId).then(async channel => {
							await channel.messages.fetch(element.messageId).then(async message => {
								await message.edit({ embeds: [targetEmbed] });
							}).catch(logger.error);
						}).catch(logger.error);
					});
				}
				i.reply({ content: 'Message Edited.', ephemeral: true });
			});
	},
};