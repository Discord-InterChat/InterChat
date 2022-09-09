import { EmbedBuilder, ActionRowBuilder, ChatInputCommandInteraction, TextChannel, TextInputBuilder, ModalBuilder, TextInputStyle } from 'discord.js';
import { colors, constants } from '../../Utils/functions/utils';
export = {
	async execute(interaction: ChatInputCommandInteraction) {
		const SUGGESTION_CHANNEL = await interaction.client.channels.fetch(constants.channel.suggestions) as TextChannel | null;

		// show modal
		const modal = new ModalBuilder()
			.setTitle('Suggestion')
			.setCustomId('suggestion')
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>()
					.addComponents(
						new TextInputBuilder()
							.setCustomId('Description')
							.setLabel('What is your suggestion about?')
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true)
							.setMaxLength(950),
					),
			);

		await interaction.showModal(modal);

		interaction.awaitModalSubmit({
			filter: (m) => m.user.id === interaction.user.id,
			time: 60000,
		}).then(async (modalInteraction) => {
			const attachment = interaction.options.getAttachment('screenshot');
			const description = modalInteraction.fields.getTextInputValue('Description');

			const suggestionEmbed = new EmbedBuilder()
				.setAuthor({ name: `Suggestion from ${modalInteraction.user.tag}`, iconURL: modalInteraction.user.displayAvatarURL() })
				.setDescription(description)
				.setImage(attachment?.url as string | null)
				.setColor(colors('chatbot'))
				.addFields({
					name: 'Status',
					value: '🧑‍💻 Pending',
				});

			await SUGGESTION_CHANNEL?.send({ embeds: [suggestionEmbed] });
			modalInteraction.reply('Suggestion sent! Join the support server to see it.');
		}).catch(() => {return;});

	},
};