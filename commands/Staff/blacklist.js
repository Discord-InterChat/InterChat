const { SlashCommandBuilder } = require('@discordjs/builders');
const { staffPermissions } = require('../../utils');
const mongoUtil = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('blacklist')
		.setDescription('Blacklist a user or server from using the bot. Staff-only')
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
									.setDescription('The user ID to blacklist.')
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
							.setDescription('Remove a user from the blacklist.')
							.addStringOption(user =>
								user
									.setName('user')
									.setDescription('The user to remove from the blacklist.')
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
						.addChoices([['User', 'user'], ['Server', 'server']]),
				),
		),
	async execute(interaction) {
		const roles = await staffPermissions(interaction);
		if (roles.includes('staff')) {
			const subCommand = interaction.options.getSubcommand();
			const database = mongoUtil.getDb();
			require(`../../scripts/blacklist/${subCommand}`).execute(interaction, database);
		}
		else {
			return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
		}
	},
};