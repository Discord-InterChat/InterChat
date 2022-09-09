import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import mongoUtil from '../../Utils/functions/utils';

export default {
	data: new SlashCommandBuilder()
		.setName('network')
		.setDescription('Manage the chat network for this server.')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('connect')
				.setDescription('Connect to the chat network.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('disconnect')
				.setDescription('Disconnect from the chat network.'),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		const subcommand = interaction.options.getSubcommand();
		const database = mongoUtil.getDb();
		const connectedList = database?.collection('connectedList');
		const serverInBlacklist = await database?.collection('blacklistedServers').findOne({ serverId: interaction.guild?.id });

		if (serverInBlacklist) {
			return await interaction.reply(`This server is blacklisted from using the ChatBot Chat Network for reason \`${serverInBlacklist.reason}\`! Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
		}

		const subcommandFile = require(`../../scripts/network/${subcommand}`);
		subcommandFile.execute(interaction, connectedList);
	},
};
