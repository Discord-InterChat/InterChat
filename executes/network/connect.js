const { stripIndents } = require('common-tags');
const logger = require('../../logger');

module.exports = {
	async execute(interaction, connectedList) {
		const findChannel = await connectedList.findOne({ channelId: interaction.channel.id });
		const findServer = await connectedList.findOne({ serverId: interaction.guild.id });

		if (findChannel) {
			await interaction.reply('This channel is already connected to the chat network.');
			return;
		}
		if (findServer) {
			const connectedChannel = await interaction.guild.channels.fetch(findServer.channelId);
			await interaction.reply(`This server is already connected to the chat network in the channel ${connectedChannel}. Please disconnect from there first.`);
			return;
		}

		const insertChannel = { channelId: interaction.channel.id, channelName: interaction.channel.name, serverId: interaction.guild.id, serverName: interaction.guild.name };

		try {
			await connectedList.insertOne(insertChannel);
			connectedList.count({}, async (error, numOfDocs) => {
				if (error) {logger.error(error);}
				if (numOfDocs > 1) {
					await interaction.reply(`This channel has been connected to the chat network. You are currently with ${numOfDocs} other servers, Enjoy! <:chat_clipart:772393314413707274>`);
				}
				else {
					await interaction.reply('This channel has been connected to the chat network, though no one else is there currently... *cricket noises* <:chat_clipart:772393314413707274>');
				}
			});
			logger.info(`${interaction.guild.name} (${interaction.guildId}) has joined the network.`);
		}
		catch (err) {
			logger.error(err);
			await interaction.reply('An error occurred while connecting to the chat network.');
		}

		const allConnectedChannels = await connectedList.find({});

		await allConnectedChannels.forEach(channelEntry => {
			interaction.client.channels.fetch(channelEntry.channelId).then(async channel => {
				await channel.send(stripIndents`
					A new server has joined us in the Network! <:chat_clipart:772393314413707274>

					**Server Name:** __${interaction.guild.name}__
					**Member Count:** __${interaction.guild.memberCount}__`);

			});
		});
	},
};
