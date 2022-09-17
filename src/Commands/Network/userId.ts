import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import { messageData } from '../../Utils/typings/types';

export default {
	data: new ContextMenuCommandBuilder()
		.setName('User ID')
		.setType(ApplicationCommandType.Message),
	async execute(interaction: MessageContextMenuCommandInteraction) {
		const target = interaction.targetMessage;
		const db = getDb()?.collection('messageData');
		const messageInDb = await db?.findOne({ channelAndMessageIds: { $elemMatch: { messageId: target.id } } }) as messageData | undefined;

		if (
			!target ||
			!target.embeds[0] ||
			!target.embeds[0].author ||
			!target.embeds[0].author.url ||
			target.author.id != interaction.client.user?.id
		) {
			return await interaction.reply({
				content: 'Invalid usage.',
				ephemeral: true,
			});
		}

		let userId = messageInDb?.authorId;

		if (!userId) {
			const targetEmbedAuthor = target.embeds[0].author.url.split('/');
			userId = targetEmbedAuthor[targetEmbedAuthor.length - 1];
		}

		await interaction.reply({ content: userId, ephemeral: true });
	},
};