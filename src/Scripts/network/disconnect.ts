import { ChatInputCommandInteraction } from 'discord.js';
import { Collection } from 'mongodb';
import logger from '../../Utils/logger';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, connectedList: Collection) {
		const findChannel = await connectedList.findOne({ channelId: interaction.channel?.id });
		if (findChannel) {
			await connectedList.deleteOne({ channelId: interaction.channel?.id });
			await interaction.reply('Disconnected from the network.');
			logger.info(`${interaction.guild?.name} (${interaction.guildId}) has disconnected from the network.`);
		}
		else {
			await interaction.reply('You are not connected to the network.');
		}
	},
};