const { SlashCommandBuilder, SlashCommandSubcommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('badge')
		.setDescription('Manage the badges for a user. ChatBot Staff Only.')
		.setDefaultPermission(false)
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName('add')
				.setDescription('Add a badge to a user')
				.addUserOption(userOption =>
					userOption
						.setName('user')
						.setRequired(true)
						.setDescription('The user to whom the badge should be added to'),
				)
				.addStringOption(stringOption =>
					stringOption
						.setName('badge')
						.setRequired(true)
						.setDescription('The badge to add'),
				),
		)
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName('remove')
				.setDescription('Remove a badge from a user')
				.addUserOption(userOption =>
					userOption
						.setName('user')
						.setDescription('The user from whom the badge should be removed from')
						.setRequired(true),
				)
				.addStringOption(stringOption =>
					stringOption
						.setName('badge')
						.setRequired(true)
						.setDescription('The badge to remove'),
				),
		),
	async execute(interaction) {
		await interaction.reply('TODO');
	},
};