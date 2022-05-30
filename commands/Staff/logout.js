const { SlashCommandBuilder } = require('@discordjs/builders');
const { staffPermissions } = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('logout')
		.setDescription('Logs the bot out.')
		.setDefaultPermission(false),
	async execute(interaction) {
		const roles = await staffPermissions(interaction);
		if (roles.includes('developer')) {
			await interaction.reply('Logged Out!');
			await interaction.client.destroy();
			process.exit(0);
		}
		else {
			return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
		}
	},
};