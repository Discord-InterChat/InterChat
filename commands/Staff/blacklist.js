const { SlashCommandBuilder } = require('@discordjs/builders');
const mongoUtil = require('../../mongoUtil');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('blacklist')
		.setDescription('Blacklist a user or server from using the bot.')
		.addSubcommandGroup(subcommandGroup =>
			subcommandGroup
				.setName('add')
				.setDescription('Add blacklist')
				.addSubcommand(
					subcommand =>
						subcommand
							.setName('user')
							.setDescription('Blacklist a user from using the bot.')
							.addUserOption(user =>
								user
									.setName('user')
									.setDescription('The user to blacklist.')
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
						.setDescription('Blacklist a server from using the bot.')
						.addStringOption(server =>
							server
								.setName('server')
								.setDescription('The server to blacklist.')
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
							.addUserOption(user =>
								user
									.setName('user')
									.setDescription('The user to remove from the blacklist.')
									.setRequired(true),
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
		const subCommand = interaction.options.getSubcommand();
		const database = mongoUtil.getDb();

		require(`../../executes/blacklist/${subCommand}`).execute(interaction, database);
	},
};