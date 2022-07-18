const { SlashCommandBuilder } = require('discord.js');
const { staffPermissions, getDb } = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('connected')
		.setDescription('Display the connected servers. (Staff only)')
		.setDefaultMemberPermissions('0')
		.addStringOption(string =>
			string
				.setName('type')
				.setDescription('The type of blacklist to list.')
				.setRequired(true)
				.addChoices(
					{ name: 'Server', value: 'server' },
					// { name: 'User', value: 'user' },
				),
		),

	async execute(interaction) {
		const perms = await staffPermissions(interaction);
		if (perms === 0) return;
		const database = getDb();
		require('../../scripts/connected/server').execute(interaction, database);

	},
};