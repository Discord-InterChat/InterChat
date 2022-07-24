const { SlashCommandBuilder } = require('discord.js');
const mongoUtil = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setDMPermission(false)
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
	/**
		 *
		 * @param {import 'discord.js'.ChatInputCommandInteraction} interaction
		 * @returns
		 */
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');
		const serverInBlacklist = await database.collection('blacklistedServers').findOne({ serverId: interaction.guild.id });
		if (serverInBlacklist) {
			await interaction.reply(`This server is blacklisted from using the ChatBot Chat Network for reason \`${serverInBlacklist.reason}\`! Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
			return;
		}
		const subcommandFile = require(`../../scripts/network/${subcommand}`);
		subcommandFile.execute(interaction, connectedList);
	},
};