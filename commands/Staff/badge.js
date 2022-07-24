const { SlashCommandBuilder } = require('discord.js');
const { checkIfStaff } = require('../../utils');
const mongoUtil = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('badge')
		.setDescription('Manage the badges for a user. Staff-only.')
		.setDefaultMemberPermissions('0')
		.addSubcommand(subcommand =>
			subcommand
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
						.setDescription('The badge to add')

						.addChoices(
							{ name: 'Developer', value: 'Developer' },
							{ name: 'Staff', value: 'Staff' },
							{ name: 'Premium', value: 'Premium' }),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
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
						.setDescription('The badge to remove')
						.addChoices(
							{ name: 'Developer', value: 'Developer' },
							{ name: 'Staff', value: 'Staff' },
							{ name: 'Premium', value: 'Premium' }),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('List all badges for a user')
				.addUserOption(userOption =>
					userOption
						.setName('user')
						.setDescription('The user to list badges for')
						.setRequired(true),
				),
		),
	async execute(interaction) {
		const perms = await checkIfStaff(interaction);
		if (perms === 0) return;
		const subcommand = interaction.options.getSubcommand();
		const user = interaction.options.getUser('user');
		const badge = interaction.options.getString('badge');

		const database = mongoUtil.getDb();
		const userBadges = database.collection('userBadges');

		if (subcommand === 'list') {
			require('../../scripts/badge/list').execute(interaction, userBadges, user);
		}
		else {
			require(`../../scripts/badge/${subcommand}`).execute(interaction, userBadges, user, badge);
		}
	},
};