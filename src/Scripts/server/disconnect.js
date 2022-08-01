const logger = require('../../utils/logger');

exports.execute = async (interaction, database) => {
	const connectedList = database.collection('connectedList');
	const guildInDb = await connectedList.findOne({ serverId: interaction.guild.id });

	if (guildInDb) {
		await connectedList.deleteOne({ serverId: interaction.guild.id });
		await interaction.reply(`Disconnected ${guildInDb.serverName} from the network.`);
		logger.info(
			`${interaction.guild.name} (${interaction.guildId}) has been force disconnected from the network by ${interaction.user.tag}.`,
		);
	}

	else {
		await interaction.reply('Server is not connected to the network.');
	}
};
