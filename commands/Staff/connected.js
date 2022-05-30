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
				.addChoices(
					{ name: 'User', value: 'user' },
					{ name: 'Server', value: 'server' }),
		),

	async execute(interaction) {
		const roles = await staffPermissions(interaction);
		console.log(roles);
		if (roles.includes('staff')) {
			const database = mongoUtil.getDb();
			require('../../scripts/connected/server').execute(interaction, database);
		}
		else {
			return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
		}
	},
};