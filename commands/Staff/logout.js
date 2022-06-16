const { SlashCommandBuilder } = require('@discordjs/builders');
const { staffPermissions } = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('logout')
		.setDescription('Logs the bot out.')
		.setDefaultMemberPermissions('0'),
	async execute(interaction) {
		const perms = await staffPermissions(interaction);
		if (perms === 0) return;
		await interaction.reply('Logged Out!');
		await interaction.client.destroy();
		process.exit(0);
	},
};