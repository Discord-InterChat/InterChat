import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default {
	data: new SlashCommandBuilder()
		.setName('network')
		.setDescription('Manage the chat network for this server. (deprecated)')
		.setDMPermission(false)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('connect')
				.setDescription('Connect to the chat network. (deprecated)'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('disconnect')
				.setDescription('Disconnect from the chat network. (deprecated)'),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		interaction.reply('This command has been deprecated. Use `/setup channel` instead.');
	},
};
