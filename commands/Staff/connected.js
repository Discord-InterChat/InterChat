const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord-api-types/v10');
const { staffPermissions } = require('../../utils');
const mongoUtil = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('connected')
		.setDescription('Display the connected servers. (Staff only)')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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
		const database = mongoUtil.getDb();
		require('../../scripts/connected/server').execute(interaction, database);

	},
};