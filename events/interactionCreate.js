const logger = require('../logger');

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		if (interaction.isCommand() || interaction.isContextMenu()) {
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
				const errorMsg = { content: 'There was an error while executing this command!', ephemeral: true, fetchReply: true };

				if (interaction.replied) {
					await interaction.followUp(errorMsg);
				}
				else {
					try {
						await interaction.reply(errorMsg);
					}
					catch {
						try {
							await interaction.followUp(errorMsg);
						}
						catch {
							await interaction.channel.send(errorMsg);
						}
					}
				}
			}
		}
	},
};