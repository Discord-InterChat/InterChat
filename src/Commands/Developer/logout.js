const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	developer: true,
	data: new SlashCommandBuilder()
		.setName('logout')
		.setDescription('Logs the bot out.')
		.setDefaultMemberPermissions('0'),
	async execute(interaction) {
		await interaction.reply('Logged Out!');
		await interaction.client.destroy();
		process.exit(0);
	},
};