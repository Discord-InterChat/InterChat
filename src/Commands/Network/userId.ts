import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export default {
	data: new ContextMenuCommandBuilder()
		.setName('User ID')
		.setType(ApplicationCommandType.Message),
	async execute(interaction: MessageContextMenuCommandInteraction) {
		const target = interaction.targetMessage;
		const messageData = getDb().messageData;
		const messageInDb = await messageData?.findFirst({ where: { channelAndMessageIds: { some: { messageId: { equals: target.id } } } } });

		let userId = messageInDb?.authorId;

		if (!userId) {
			const targetEmbedAuthor = target.embeds[0]?.author?.url?.split('/');
			if (!targetEmbedAuthor) return interaction.reply({ content: 'Unable to find authorId :(', ephemeral: true });
			userId = targetEmbedAuthor[targetEmbedAuthor.length - 1];
		}

		await interaction.reply({ content: userId, ephemeral: true });
	},
};