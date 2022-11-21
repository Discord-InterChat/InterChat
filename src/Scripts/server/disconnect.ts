import { ChatInputCommandInteraction } from 'discord.js';
import { NetworkManager } from '../../Structures/network';
import { getDb, getGuildName } from '../../Utils/functions/utils';
import { modActions } from '../networkLogs/modActions';
import logger from '../../Utils/logger';

exports.execute = async (interaction: ChatInputCommandInteraction) => {
	const serverId = interaction.options.getString('serverid', true);

	const database = getDb();
	const connectedList = database.connectedList;
	const guildInDb = await connectedList.findFirst({ where: { serverId } });
	const network = new NetworkManager();

	if (!guildInDb) return await interaction.reply('Server is not connected to the network.');

	await network.disconnect({ serverId });

	modActions(interaction.user, {
		guild: { id: serverId },
		action: 'disconnect',
		timestamp: new Date(),
		reason: 'Force disconnect by moderator.',
	});

	await interaction.reply(`Disconnected ${getGuildName(interaction.client, guildInDb.serverId)} from the network.`);
	logger.info(`${getGuildName(interaction.client, guildInDb.serverId)} (${guildInDb.serverId}) has been force disconnected from the network by ${interaction.user.tag}.`);
};
