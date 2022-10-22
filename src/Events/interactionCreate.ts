import { ChannelType, Interaction } from 'discord.js';
import { checkIfStaff } from '../Utils/functions/utils';
import logger from '../Utils/logger';

export default {
	name: 'interactionCreate',
	async execute(interaction: Interaction) {
		if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
		// Basic perm check, it wont cover all bugs
			if (
				interaction.guild &&
				interaction.channel?.type == ChannelType.GuildText &&
				!interaction.guild.members.me?.permissionsIn(interaction.channel).has('SendMessages') &&
				!interaction.guild.members.me?.permissionsIn(interaction.channel).has('EmbedLinks')
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
				if (command.staff === true && await checkIfStaff(interaction.client, interaction.user) === false) {
					interaction.reply(noPermsMsg);
					return;
				}
				if (command.developer === true && await checkIfStaff(interaction.client, interaction.user, true) === false) {
					interaction.reply(noPermsMsg);
					return;
				}
				await command.execute(interaction);
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			catch (error: any) {
				logger.error(`Error while executing command ${interaction.commandName}: ${error}`);

				const errorMsg = {
					content: 'There was an error while executing this command! The developers have been notified.',
					ephemeral: true,
					fetchReply: true,
				};

				if (interaction.deferred) await interaction.followUp(errorMsg);
				else if (interaction.replied) await interaction.channel?.send(errorMsg);
				else await interaction.reply(errorMsg);
			}
		}

		else if (interaction.isAutocomplete()) {
			const command = interaction.client.commands.get(interaction.commandName);

			if (!command || !command.autocomplete) return;

			command.autocomplete(interaction);
		}
	},
};
