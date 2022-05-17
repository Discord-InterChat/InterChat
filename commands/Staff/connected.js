const { SlashCommandBuilder } = require('@discordjs/builders');
const { staffPermissions } = require('../../utils');
const mongoUtil = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('connected')
		.setDescription('Blacklist a user or server from using the bot. Staff-only')
		.addStringOption(string =>
			string
				.setName('type')
				.setDescription('The type of blacklist to list.')
				.setRequired(true)
				.addChoice('Server', 'server'),
		),

	async execute(interaction) {
		const roles = await staffPermissions(interaction);
		if (roles === 'staff') {
			const database = mongoUtil.getDb();
			require('../../scripts/connected/list').execute(interaction, database);
		}
		else {
			return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
		}
	},
};