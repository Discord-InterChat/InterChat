import { ChatInputCommandInteraction } from 'discord.js';
import { Db } from 'mongodb';
import logger from '../../Utils/logger';

exports.execute = async (interaction: ChatInputCommandInteraction, database: Db) => {
	const serverId = interaction.options.getString('serverid');
	const connectedList = database.collection('connectedList');
	const guildInDb = await connectedList.findOne({ serverId });

	if (!guildInDb) return await interaction.reply('Server is not connected to the network.');

	await connectedList.deleteOne({ serverId });
	await interaction.reply(`Disconnected ${guildInDb.serverName} from the network.`);
	logger.info(`${guildInDb.serverName} (${guildInDb.serverId}) has been force disconnected from the network by ${interaction.user.tag}.`);
};
