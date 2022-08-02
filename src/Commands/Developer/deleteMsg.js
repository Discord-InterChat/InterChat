const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } = require('discord.js');
const { getDb, checkIfStaff } = require('../../utils/functions/utils');
const logger = require('../../utils/logger');
module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('Delete Message')
		.setType(ApplicationCommandType.Message),
	/**
         *
         * @param {MessageContextMenuCommandInteraction} interaction
         */
	async execute(interaction) {
		checkIfStaff(interaction, true);

		const target = interaction.targetMessage;

		const db = getDb();
		const messageInDb = await db.collection('messageData').find({ channelAndMessageIds: { $elemMatch: { messageId: target.id } } }).toArray();

		if (messageInDb[0].channelAndMessageIds) {
			messageInDb[0].channelAndMessageIds.forEach(async element => {
				await interaction.client.channels.fetch(element.channelId).then(async channel => {
					await channel.messages.fetch(element.messageId).then(async message => {
						await message.delete();
					}).catch(logger.error);
				}).catch(logger.error);
			});
		}
		interaction.reply({ content: 'Message deleted.', ephemeral: true });

	},
};