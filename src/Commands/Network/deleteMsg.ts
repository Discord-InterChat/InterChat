import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, TextChannel } from 'discord.js';
import { getDb, checkIfStaff } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';
import { stripIndents } from 'common-tags';

export default {
	data: new ContextMenuCommandBuilder()
		.setName('Delete Message')
		.setType(ApplicationCommandType.Message),
	async execute(interaction: MessageContextMenuCommandInteraction) {
		const target = interaction.targetMessage;
		const staffUser = await checkIfStaff(interaction.client, interaction.user);

		const db = getDb();
		const messageInDb = await db?.messageData.findFirst({
			where: { channelAndMessageIds: { some: { messageId: { equals: target.id } } } },
		});

		if (!messageInDb || messageInDb?.expired && staffUser === false) return interaction.reply({ content: 'This message has expired.', ephemeral: true });

		if ((staffUser || interaction.user.id === messageInDb?.authorId)) {
			messageInDb?.channelAndMessageIds.forEach((element) => {
				if (!element) return;

				interaction.client.channels
					.fetch(element.channelId)
					.then((channel) => {
						(channel as TextChannel)
							.messages
							.fetch(element.messageId)
							.then((message) => message.delete().catch())
							.catch((e) => logger.error('Delete Message Command:', e));
					}).catch(logger.error);
			});


			interaction.reply({ content: 'Message deleted.', ephemeral: true });
		}

		else {
			interaction.reply({
				content: stripIndents`${interaction.client.emoji.normal.no} Unable to delete message.\nCommon Reasons: Message not sent by you, Message not sent in network.`,
				ephemeral: true,
			});
		}
	},
};