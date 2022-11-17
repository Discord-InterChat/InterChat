import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export default {
	staff: true,
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
							{ name: 'Voter', value: 'Voter' }),
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
						.setDescription('The badge to remove')
						.setRequired(true)
						.addChoices(
							{ name: 'Developer', value: 'Developer' },
							{ name: 'Staff', value: 'Staff' },
							{ name: 'Voter', value: 'Voter' }),
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
	async execute(interaction: ChatInputCommandInteraction) {
		const subcommand = interaction.options.getSubcommand();
		const user = interaction.options.getUser('user');
		const badge = interaction.options.getString('badge');

		const database = getDb();
		const userBadges = database?.userBadges;

		if (subcommand === 'list') {
			require('../../Scripts/badge/list').execute(interaction, userBadges, user);
		}
		else {
			require(`../../Scripts/badge/${subcommand}`).execute(interaction, userBadges, user, badge);
		}
	},
};