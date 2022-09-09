import { ChatInputCommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { constants } from '../../Utils/functions/utils';

export default {
	execute: async (interaction: ChatInputCommandInteraction) => {
		const messageId = interaction.options.getString('messageid');
		const status = interaction.options.getString('status');
		const reason = interaction.options.getString('reason');
		const suggestionChannel = await interaction.client.channels.fetch(constants.channel.suggestions) as TextChannel | null;
		const suggestionMessage = await suggestionChannel?.messages.fetch(String(messageId)).catch(() => {
			interaction.reply('Unable to locate the message. Please make sure the message ID is valid.');
			return;
		});

		if (!suggestionMessage ||
			suggestionMessage.embeds.length < 1 ||
			suggestionMessage.author.id != interaction.client.user?.id ||
			suggestionMessage.embeds[0].description?.includes('taken down')
		) {
			await interaction.reply('Unable to locate the message. Please make sure the message ID is valid.');
			return;
		}
		const suggestionEmbed = new EmbedBuilder(suggestionMessage.embeds[0].toJSON());
		suggestionEmbed.setFields({ name: 'Status', value: String(status), inline: true });
		if (reason) suggestionEmbed.addFields({ name: 'Message From Staff/Developers', value: String(reason), inline: true });
		await suggestionMessage.edit({ embeds: [suggestionEmbed] });

		interaction.reply('Updated suggestion!');

	},
};