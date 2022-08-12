const logger = require('../../utils/logger');

exports.execute = async (interaction, database) => {
	const serverId = interaction.options.getString('serverid');
	const connectedList = database.collection('connectedList');
	const guildInDb = await connectedList.findOne({ serverId });

	if (!guildInDb) return await interaction.reply('Server is not connected to the network.');

	await connectedList.deleteOne({ serverId });
	await interaction.reply(`Disconnected ${guildInDb.serverName} from the network.`);
	logger.info(`${interaction.guild.name} (${interaction.guildId}) has been force disconnected from the network by ${interaction.user.tag}.`);
};
