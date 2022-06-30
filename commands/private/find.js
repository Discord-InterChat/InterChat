const { SlashCommandBuilder } = require('@discordjs/builders');
const { CommandInteraction, MessageEmbed, SelectMenuInteraction, MessageActionRow, MessageSelectMenu } = require('discord.js');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('find')
		.setDescription('Find users/servers by name or ID.')
		.addStringOption(option =>
			option
				.setName('type')
				.setDescription('Specify if you want to get data on a user or guild.')
				.setRequired(true)
				.addChoices(
					{ name: 'Server', value: 'server' },
					{ name: 'User', value: 'user' },
				),
		)
		.addStringOption(option =>
			option
				.setRequired(true)
				.setName('name-id')
				.setDescription('The server name or ID.'),
		),
	/**
    * @param {CommandInteraction} interaction
    */
	async execute(interaction) {
		const data = interaction.options.getString('name-id');
		const type = interaction.options.getString('type');

		if (!type) return interaction.reply('Type required.');

		require(`../../scripts/find/${type}`).execute(interaction, data);
	},
};