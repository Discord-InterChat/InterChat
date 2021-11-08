const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('logout')
		.setDescription('Logs the bot out.'),
	async execute(interaction) {
		await interaction.reply('Logging out...');
		await interaction.client.logout();
		await interaction.followUp('Logged out.');
	},
};