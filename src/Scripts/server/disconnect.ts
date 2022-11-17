import { PrismaClient } from '@prisma/client';
import { ChatInputCommandInteraction } from 'discord.js';
import logger from '../../Utils/logger';
import { getGuildName } from '../../Utils/functions/utils';

exports.execute = async (interaction: ChatInputCommandInteraction, database: PrismaClient) => {
	const serverId = interaction.options.getString('serverid');
	const connectedList = database.connectedList;
	const guildInDb = await connectedList.findFirst({
		where: {
			serverId: serverId ? serverId : undefined,
		},
	});

	if (!guildInDb) return await interaction.reply('Server is not connected to the network.');

	await connectedList.deleteMany({
		where: {
			serverId: serverId ? serverId : undefined,
		},
	});
	await interaction.reply(`Disconnected ${getGuildName(interaction.client, guildInDb.serverId)} from the network.`);
	logger.info(`${getGuildName(interaction.client, guildInDb.serverId)} (${guildInDb.serverId}) has been force disconnected from the network by ${interaction.user.tag}.`);
};
