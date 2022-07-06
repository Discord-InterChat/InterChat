const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('support')
		.setDescription('Contact the developers for suggestions/reports.')
		.addSubcommand(subcommand =>
			subcommand
				.setName('suggest')
				.setDescription('Suggest commands/features to be added to the bot.')
				.addStringOption(option =>
					option
						.setName('suggestion')
						.setRequired(true)
						.setDescription('The suggestion for the bot.'),
				)
				.addAttachmentOption(option =>
					option
						.setName('attachment')
						.setDescription('Attach a file to the suggestion.')
						.setRequired(false),
				),
		)
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
							{ name: 'Bug', value: 'Bug' },
							{ name: 'Other', value: 'Other' }),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('server')
				.setDescription('Get the invite to the support server.'),
		),
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		require(`../../scripts/support/${subcommand}`).execute(interaction);
	},
};