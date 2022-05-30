const logger = require('../logger');

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		if (!interaction.isCommand()) return;
		// Basic perm check, it wont cover all bugs
		if (!interaction.guild.me.permissionsIn(interaction.channel).has('SEND_MESSAGES') && !interaction.guild.me.permissionsIn(interaction.channel).has('EMBED_LINKS')) {
			return interaction.reply({ content: 'I do not have the right permissions in this server to function properly! Please either re-invite me or grant me the right permissions.', ephemeral: true });
		}
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) return;

		try {
			await command.execute(interaction);
		}
		catch (error) {
			logger.error(error);
			try {
				await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
			}
			catch {
				return await interaction.channel.send({ content: 'There was an error while executing this command!', ephemeral: true });
			}
		}
	},
};