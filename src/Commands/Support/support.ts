import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('support')
		.setDescription('Contact the developers for suggestions/reports.')
		.setDMPermission(false)
		.addSubcommand(subcommand =>
			subcommand
				.setName('suggest')
				.setDescription('Suggest commands/features to be added to the bot.')
				.addAttachmentOption(option =>
					option
						.setName('screenshot')
						.setDescription('Attach a screenshot of your suggestion. (Optional)')
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
	async execute(interaction: ChatInputCommandInteraction) {
		const subcommand = interaction.options.getSubcommand();
		require(`../../Scripts/support/${subcommand}`).execute(interaction);
	},
};