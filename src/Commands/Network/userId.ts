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

		let userId = messageInDb?.authorId;

		if (!userId) {
			const targetEmbedAuthor = target.embeds[0]?.author?.url?.split('/');
			if (!targetEmbedAuthor) return interaction.reply({ content: 'Unable to find authorId :(', ephemeral: true });
			userId = targetEmbedAuthor[targetEmbedAuthor.length - 1];
		}

		await interaction.reply({ content: userId, ephemeral: true });
	},
};