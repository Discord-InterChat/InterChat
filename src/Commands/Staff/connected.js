const { SlashCommandBuilder } = require('discord.js');
const { checkIfStaff } = require('../../utils/functions/utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('connected-list')
		.setDescription('Display the connected servers. (Staff only)')
		.setDefaultMemberPermissions('0'),

	async execute(interaction) {
		const perms = await checkIfStaff(interaction);
		if (perms === 0) return;

		require('../../scripts/connected/server').execute(interaction);

	},
};