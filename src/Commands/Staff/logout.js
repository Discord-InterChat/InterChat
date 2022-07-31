const { SlashCommandBuilder } = require('discord.js');
const { checkIfStaff } = require('../../utils/functions/utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('logout')
		.setDescription('Logs the bot out.')
		.setDefaultMemberPermissions('0'),
	async execute(interaction) {
		const perms = await checkIfStaff(interaction);
		if (perms === 0) return;
		await interaction.reply('Logged Out!');
		await interaction.client.destroy();
		process.exit(0);
	},
};