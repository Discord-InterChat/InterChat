const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('logout')
		.setDescription('Logs the bot out.'),
	async execute(interaction) {
		let guild;
		let member;
		try {
			guild = await interaction.client.guilds.fetch('969920027421732874');
			member = await guild.members.fetch(interaction.user.id);
		}
		catch {
			return interaction.reply('You do not have permissions to use this command.');
		}
		const roles = await member._roles;
		const developer = '970706750229586010';

		if (roles.includes(developer)) {
			await interaction.reply('Logged Out!');
			await interaction.client.destroy();
			process.exit(0);
		}
		else {
			return interaction.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
		}
	},
};