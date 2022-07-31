const { SlashCommandBuilder } = require('discord.js');
const { checkIfStaff, getDb } = require('../../utils/functions/utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('blacklist')
		.setDescription('Blacklist a user or server from using the bot. Staff-only')
		.setDefaultMemberPermissions('0')
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('add')
				.setDescription('Add blacklist')
				.addSubcommand(
					subcommand =>
						subcommand
							.setName('user')
							.setDescription('Blacklist a user from using the bot. Staff-only')
							.addStringOption(user =>
								user
									.setName('user')
									.setDescription('The user ID to blacklist. User tag also works if they are already cached.')
									.setRequired(true),
							)
							.addStringOption(string =>
								string
									.setName('reason')
									.setDescription('The reason for blacklisting the user.')
									.setRequired(true),
							),
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('server')
						.setDescription('Blacklist a server from using the bot. Staff-only')
						.addStringOption(server =>
							server
								.setName('server')
								.setDescription('The server ID to blacklist.')
								.setRequired(true),
						)
						.addStringOption(string =>
							string
								.setName('reason')
								.setDescription('The reason for blacklisting the server.')
								.setRequired(true),
						),
				),
		)
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('remove')
				.setDescription('Remove blacklist')
				.addSubcommand(
					subcommand =>
						subcommand
							.setName('user')
							.setDescription('Remove a user from the blacklist. Staff-only')
							.addStringOption(user =>
								user
									.setName('user')
									.setDescription('The user to remove from the blacklist. User tag also works.')
									.setRequired(true),
							)
							.addStringOption(string =>
								string
									.setName('reason')
									.setDescription('The reason for blacklisting the server.'),
							),
				)
				.addSubcommand(subcommand =>
					subcommand
						.setName('server')
						.setDescription('Remove a server from the blacklist.')
						.addStringOption(server =>
							server
								.setName('server')
								.setDescription('The server to remove from the blacklist.')
								.setRequired(true),
						)
						.addStringOption(string =>
							string
								.setName('reason')
								.setDescription('The reason for blacklisting the server.'),
						),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('List all blacklists.')
				.addStringOption(string =>
					string
						.setName('type')
						.setDescription('The type of blacklist to list.')
						.setRequired(true)
						.addChoices(
							{ name: 'User', value: 'user' },
							{ name: 'Server', value: 'server' }),
				),
		),
	async execute(interaction) {
		const perms = await checkIfStaff(interaction);
		if (perms === 0) return;

		const subCommand = interaction.options.getSubcommand();
		const database = getDb();
		require(`../../scripts/blacklist/${subCommand}`).execute(interaction, database);

	},
};