const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('modal_support')
		.setDescription('Contact the developers for suggestions/reports.')
		.addSubcommand(subcommand =>
			subcommand
				.setName('report')
				.setDescription('Report a user, server, bug, or others in the bot.')
				.addStringOption(option =>
					option
						.setName('type')
						.setRequired(true)
						.setDescription('The type of report.')
						.addChoices(
							{ name: 'User', value: 'user' },
							{ name: 'Server', value: 'server' },
							{ name: 'Bug', value: 'bug' },
							{ name: 'Other', value: 'other' }),
				),
		),
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		require('../../scripts/support/modal_script.js').execute(interaction);
	},
};