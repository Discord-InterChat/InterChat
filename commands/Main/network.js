const { SlashCommandBuilder } = require('@discordjs/builders');
const mongoUtil = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('network')
		.setDescription('Manage the chat network for this server.')
		.addSubcommand(subcommand =>
			subcommand
				.setName('connect')
				.setDescription('Connect to the chat network.'),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('disconnect')
				.setDescription('Disconnect from the chat network.'),
		),
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');

		const subcommandFile = require(`../../executes/network/${subcommand}`);
		subcommandFile.execute(interaction, connectedList);
	},
};