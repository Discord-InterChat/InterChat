import { ChatInputCommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { colors, constants } from '../../Utils/functions/utils';

export default {
	execute: async (interaction: ChatInputCommandInteraction) => {
		const messageId = interaction.options.getString('messageid');
		const keep = interaction.options.getBoolean('keepmessage');
		const suggestionChannel = await interaction.client.channels.fetch(constants.channel.suggestions) as TextChannel | null;
		const suggestionMessage = await suggestionChannel?.messages.fetch(String(messageId)).catch(() => {
			interaction.reply('Unable to locate the message. Please make sure the message ID is valid.');
		});

		if (suggestionMessage?.author.id != interaction.client.user?.id) {
			await interaction.reply('Unable to locate the message. Please make sure the message ID is valid.');
			return;
		}

		if (keep) {
			suggestionMessage?.edit({
				embeds: [
					new EmbedBuilder()
						.setDescription('*This suggestion was taken down.*')
						.setColor(colors('invisible')),
				],
			});
		}

		else {
			suggestionMessage?.delete().catch(() => {
				return interaction.reply('Unable to delete message!');
			});
		}

		interaction.reply('🗑️ Suggestion discarded.');

	},
};