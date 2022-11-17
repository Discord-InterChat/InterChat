import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export default {
	data: new ContextMenuCommandBuilder()
		.setName('Server ID')
		.setType(ApplicationCommandType.Message),
	async execute(interaction: MessageContextMenuCommandInteraction) {
		const target = interaction.targetMessage;
		const messageData = getDb().messageData;
		const messageInDb = await messageData?.findFirst({ where: { channelAndMessageIds: { some: { messageId: { equals: target.id } } } } });

		// TODO: Implement logging system first, that logs when someone joins/leave network with servrer id
		if (!messageInDb?.serverId) {
			await interaction.reply({
				content: 'Could not find the server in the database. The message may have expired.',
				ephemeral: true,
			});
			return;
		}

		const serverId = messageInDb?.serverId;
		await interaction.reply({ content: serverId, ephemeral: true });
	},
};
