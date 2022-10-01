import { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, TextChannel } from 'discord.js';
import { getDb, checkIfStaff } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';
import { stripIndents } from 'common-tags';
import { messageData } from '../../Utils/typings/types';


export default {
	data: new ContextMenuCommandBuilder()
		.setName('Delete Message')
		.setType(ApplicationCommandType.Message),
	async execute(interaction: MessageContextMenuCommandInteraction) {

		const target = interaction.targetMessage;
		const staffUser = await checkIfStaff(interaction.client, interaction.user);

		const db = getDb();
		const messageInDb = await db?.collection('messageData').findOne({ channelAndMessageIds: { $elemMatch: { messageId: target.id } } }) as messageData | undefined;

		if ((staffUser || interaction.user.id === messageInDb?.authorId)) {
			messageInDb?.channelAndMessageIds.forEach(async (element) => {
				await interaction.client.channels.fetch(element.channelId).then(async (channel) => {
					await (channel as TextChannel).messages.fetch(element.messageId).then(async (message) => {
						await message.delete();
					}).catch(logger.error);
				}).catch(logger.error);
			});


			interaction.reply({ content: 'Message deleted.', ephemeral: true });
		}

		else {
			interaction.reply({
				content: stripIndents`${interaction.client.emoji.normal.no} Unable to delete message.
				Common Reasons: Message Expired, Message not sent by You, Message not sent in network.`, ephemeral: true });
		}
	},
};