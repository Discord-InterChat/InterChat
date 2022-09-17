import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { colors } from '../../Utils/functions/utils';

export = {
	async execute(interaction: ChatInputCommandInteraction) {
		const embed = new EmbedBuilder()
			.setTitle('ChatBot HQ')
			.setDescription('[Click Here](<https://discord.gg/6bhXQynAPs>)')
			.setColor(colors('chatbot'))
			.setTimestamp();
		await interaction.reply({ embeds: [embed] });
	},
};