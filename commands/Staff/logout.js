const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('logout')
		.setDescription('Logs the bot out.')
		.setDefaultPermission(false),
	async execute(interaction) {
		await interaction.reply('Logged Out!');
		await interaction.client.logout();
	},
};