const { EmbedBuilder } = require('discord.js');
const { colors } = require('../../utils');

module.exports = {
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setTitle('ChatBot HQ')
			.setDescription('[Click Here](<https://discord.gg/6bhXQynAPs>)')
			.setColor(colors())
			.setTimestamp();
		await interaction.reply({ embeds: [embed] });
	},
};