const logger = require('../logger');

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		if (!interaction.isCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) return;

		try {
			await command.execute(interaction);
			logger.info(`Command '${interaction.commandName}' was executed in '${interaction.guild.name}' (${interaction.guildId}) by '${interaction.member.user.tag}' (${interaction.member.id})`);
		}
		catch (error) {
			logger.error(error);
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	},
};