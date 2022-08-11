const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } = require('discord.js');
const { getDb, checkIfStaff } = require('../../utils/functions/utils');
const emojis = require('../../utils/emoji.json');
const logger = require('../../utils/logger');
const { stripIndents } = require('common-tags');
module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('Delete Message')
		.setType(ApplicationCommandType.Message),
	/**
	* @param {MessageContextMenuCommandInteraction} interaction
	*/
	async execute(interaction) {
		const target = interaction.targetMessage;
		const staffUser = await checkIfStaff(interaction.client, interaction.user);

		const db = getDb();
		const messageInDb = await db.collection('messageData').find({ channelAndMessageIds: { $elemMatch: { messageId: target.id } } }).toArray();

		if (messageInDb.length > 0 && (staffUser || messageInDb[0].authorId === interaction.user.id)) {
			messageInDb[0].channelAndMessageIds.forEach(async element => {
				await interaction.client.channels.fetch(element.channelId).then(async channel => {
					await channel.messages.fetch(element.messageId).then(async message => {
						await message.delete();
					}).catch(logger.error);
				}).catch(logger.error);
			});


			interaction.reply({ content: 'Message deleted.', ephemeral: true });
		}

		else {
			interaction.reply({
				content: stripIndents`${emojis.normal.no} Unable to delete message.
				Common Reasons: Message Expired, Message not sent by You, Message not sent in network.`, ephemeral: true });
		}
	},
};