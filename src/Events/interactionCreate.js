const { InteractionType } = require('discord.js');
const { checkIfStaff } = require('../utils/functions/utils');
const logger = require('../utils/logger');

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
			if (interaction.commandName === 'help') {
				const focusedValue = interaction.options.getFocused();
				let choices = [];
				const ignore = ['server id', 'user id', 'test'];
				let filtered;

				if (focusedValue === '') {
					choices = [
						{ name: '📌Setup', value: 'setup' },
						{ name: '📌Help', value: 'help' },
						{ name: '📌Suggest', value: 'support' },
						{ name: '📌Report', value: 'support' },
						{ name: '📌Server', value: 'support' },
						{ name: '📌Connect', value: 'network' },
						{ name: '📌Disconnect', value: 'network' },
					];
					filtered = choices.filter((choice) => choice.value.startsWith(focusedValue));
				}
				else {
					const commands = interaction.client.commands.filter((cmd) => {
						if (ignore.includes(cmd.data.name)) return false;
						return true;
					});
					await commands.map((command) => choices.push(command.data.name));
					filtered = choices.filter((choice) => choice.startsWith(focusedValue));
				}

				await interaction.respond(
					filtered.map((choice) => ({
						name: choice.name || choice,
						value: choice.value || choice,
					})),
				);
			}
		}

		if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
			// Basic perm check, it wont cover all bugs
			if (
				interaction.guild &&
				!interaction.guild.members.me.permissionsIn(interaction.channel).has('SendMessages') &&
				!interaction.guild.members.me.permissionsIn(interaction.channel).has('EmbedLinks')
			) {
				return interaction.reply({
					content: 'I do not have the right permissions in this server to function properly!',
					ephemeral: true,
				});
			}
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) return;

			try {
				const noPermsMsg = {
					content: 'You do not have the right permissions to use this command!',
					ephemeral: true,
				};
				if (command.staff && await checkIfStaff(interaction.client, interaction.user) === false) {
					interaction.reply(noPermsMsg);
					return;
				}
				if (command.developer && await checkIfStaff(interaction.client, interaction.user, true) === false) {
					interaction.reply(noPermsMsg);
					return;
				}
				await command.execute(interaction);
			}
			catch (error) {
				logger.error(error);
				const errorMsg = {
					content: 'There was an error while executing this command!',
					ephemeral: true,
					fetchReply: true,
				};

				if (interaction.deferred) await interaction.followUp(errorMsg);
				else if (interaction.replied) await interaction.channel.send(errorMsg);
				else await interaction.reply(errorMsg);
			}
		}
	},
};
