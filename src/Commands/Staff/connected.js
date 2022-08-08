const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	staff: true,
	data: new SlashCommandBuilder()
		.setName('connected-list')
		.setDescription('Display the connected servers. (Staff only)')
		.setDefaultMemberPermissions('0'),

	async execute(interaction) {
		require('../../scripts/connected/server').execute(interaction);
	},
};