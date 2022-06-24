const logger = require('../logger');

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		if (interaction.isAutocomplete()) {
			if (interaction.commandName === 'help') {
				const focusedValue = interaction.options.getFocused();
				let choices = [];
				const ignore = ['server id', 'user id', 'test'];
				let filtered;

				if (focusedValue === '') {
					choices = [
						{ name: '📍 Setup', value: 'setup' },
						{ name: '📍 Help', value: 'help' },
						{ name: '📍 Suggest', value: 'support' },
						{ name: '📍 Report', value: 'support' },
						{ name: '📍 Server', value: 'support' },
						{ name: '📍 Connect', value: 'network' },
						{ name: '📍 Disconnect', value: 'network' },
					];
					filtered = choices.filter(choice => choice.value.startsWith(focusedValue));
				}

				else {
					const commands = interaction.client.commands.filter((cmd) => {
						if (ignore.includes(cmd.data.name)) return false;
						return true;
					});
					await commands.map((command) => choices.push(command.data.name));
					filtered = choices.filter(choice => choice.startsWith(focusedValue));
				}

				await interaction.respond(
					filtered.map(choice => ({ name: choice.name || choice, value: choice.value || choice })),
				);
			}
		}

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

				if (interaction.replied) await interaction.followUp(errorMsg);
				else await interaction.reply(errorMsg);
			}
		}
	},
};