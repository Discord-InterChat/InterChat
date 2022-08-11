const logger = require('../../utils/logger');
const Filter = require('bad-words'),
	filter = new Filter();
const { stripIndents } = require('common-tags');
const { normal } = require('../../utils/emoji.json');
const { sendInNetwork, deleteChannels } = require('../../utils/functions/utils');

module.exports = {
	async execute(interaction, connectedList) {
		if (filter.isProfane(interaction.guild.name)) {
			return interaction.reply(
				'I have detected words in the *server name* that are potentially offensive, Please correct them before using this chat!',
			);
		}

		const findChannel = await connectedList.findOne({ channelId: interaction.channel.id });
		const findServer = await connectedList.findOne({ serverId: interaction.guild.id });

		if (findChannel) {
			await interaction.reply('This channel is already connected to the chat network.');
			return;
		}
		if (findServer) {
			// [FIXED] Bot crashes when channel is deleted in the same guild before disconnection
			// FIXME: Bot says channel is connected to undefined if its from the same server, because it is already inside
			// the if statement, make it reset or something idk
			let connectedChannel;
			try {
				connectedChannel = await interaction.guild.channels.fetch(findServer.channelId);
			}
			catch (err) {
				deleteChannels(interaction.client);
			}

			await interaction.reply(
				`This server is already connected to the chat network in the channel ${connectedChannel}. Please disconnect from there first.`,
			);
			return;
		}

		const insertChannel = {
			channelId: interaction.channel.id,
			channelName: interaction.channel.name,
			serverId: interaction.guild.id,
			serverName: interaction.guild.name,
		};

		try {
			await connectedList.insertOne(insertChannel);
			connectedList.count({}, async (error, numOfDocs) => {
				if (error) {
					logger.error(error);
				}
				if (numOfDocs > 1) {
					await interaction.reply(
						`This channel has been connected to the chat network. You are currently with ${numOfDocs} other servers, Enjoy! ${normal.clipart}`,
					);
				}
				else {
					await interaction.reply(
						`This channel has been connected to the chat network, though no one else is there currently... *cricket noises* ${normal.clipart}`,
					);
				}
			});
			logger.info(
				`${interaction.guild.name} (${interaction.guildId}) has joined the network.`,
			);
		}
		catch (err) {
			logger.error(err);
			await interaction.reply('An error occurred while connecting to the chat network.');
		}

		sendInNetwork(
			interaction,
			stripIndents`
					A new server has joined us in the Network! ${normal.clipart}

					**Server Name:** __${interaction.guild.name}__
					**Member Count:** __${interaction.guild.memberCount}__`,
		);
	},
};