import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
export default {
	data: new SlashCommandBuilder()
		.setName('find')
		.setDescription('Find users/servers by name or ID.')
		.addStringOption((option) =>
			option
				.setName('type')
				.setDescription('Specify if you want to get data on a user or guild.')
				.setRequired(true)
				.addChoices({ name: 'Server', value: 'server' }, { name: 'User', value: 'user' }),
		)
		.addStringOption((option) =>
			option.setRequired(true).setName('name-id').setDescription('The server name or ID.'),
		),
	async execute(interaction: ChatInputCommandInteraction) {
		const data = interaction.options.getString('name-id');
		const type = interaction.options.getString('type');

		require(`../../Scripts/find/${type}`).execute(interaction, data);
	},
};
