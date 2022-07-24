const { SlashCommandBuilder } = require('discord.js');
const { checkPermissions } = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('level')
		.setDefaultMemberPermissions('0')
		.setDescription('Level managing command. Staff-only')
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('add')
				.setDescription('Add Level/XP')
				.addSubcommand(
					subcommand =>
						subcommand
							.setName('level')
							.setDescription('Add Level to user. Staff-only')
							.addStringOption(user =>
								user
									.setName('user')
									.setDescription('The user ID to add level.')
									.setRequired(true),
							)
							.addIntegerOption(string =>
								string
									.setName('level')
									.setDescription('Levels to add.')
									.setRequired(true),
							),
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('xp')
						.setDescription('Add XP to user. Staff-only')
						.addStringOption(user =>
							user
								.setName('user')
								.setDescription('The user ID to add level.')
								.setRequired(true),
						)
						.addIntegerOption(string =>
							string
								.setName('xp')
								.setDescription('XP to  add.')
								.setRequired(true),
						),
				),
		)
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('remove')
				.setDescription('Remove Level/XP')
				.addSubcommand(
					subcommand =>
						subcommand
							.setName('level')
							.setDescription('Remove Level to user. Staff-only')
							.addStringOption(user =>
								user
									.setName('user')
									.setDescription('The user ID to remove level.')
									.setRequired(true),
							)
							.addIntegerOption(int =>
								int
									.setName('level')
									.setDescription('Levels to remove.')
									.setRequired(true),
							),
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('xp')
						.setDescription('Remove XP to user. Staff-only')
						.addStringOption(user =>
							user
								.setName('user')
								.setDescription('The user ID to remove level.')
								.setRequired(true),
						)
						.addIntegerOption(int =>
							int
								.setName('xp')
								.setDescription('XP to remove.')
								.setRequired(true),
						),
				),
		)
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('set')
				.setDescription('Set Level/XP')
				.addSubcommand(
					subcommand =>
						subcommand
							.setName('level')
							.setDescription('Set Level to user. Staff-only')
							.addStringOption(user =>
								user
									.setName('user')
									.setDescription('The user ID to set level.')
									.setRequired(true),
							)
							.addIntegerOption(string =>
								string
									.setName('level')
									.setDescription('Levels to set.')
									.setRequired(true),
							),
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('xp')
						.setDescription('Set XP to user. Staff-only')
						.addStringOption(user =>
							user
								.setName('user')
								.setDescription('The user ID to set level.')
								.setRequired(true),
						)
						.addIntegerOption(string =>
							string
								.setName('xp')
								.setDescription('XP to set.')
								.setRequired(true),
						),
				),
		),
	async execute(interaction) {
		const perms = await checkPermissions(interaction);
		if (perms === 0) return;
		const subCommand = interaction.options.getSubcommand();
		require(`../../scripts/level/${subCommand}`).execute(interaction);
	},

};