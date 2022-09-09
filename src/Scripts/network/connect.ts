import logger from '../../Utils/logger';
import { stripIndents } from 'common-tags';
import { normal } from '../../Utils/emoji.json';
import { deleteChannels } from '../../Utils/functions/utils';
import filter from '../../Utils/functions/wordFilter';
import { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { Collection } from 'mongodb';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, connectedList: Collection) {
		if (filter.check(interaction.guild?.name)) {
			return interaction.reply('I have detected words in the *server name* that are potentially offensive, Please correct them before using this chat!');
		}

		const findChannel = await connectedList.findOne({ channelId: interaction.channel?.id });
		const findServer = await connectedList.findOne({ serverId: interaction.guild?.id });

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
				connectedChannel = await interaction.guild?.channels.fetch(findServer.channelId);
			}
			catch (err) {
				deleteChannels(interaction.client);
				interaction.reply('Connected channel has been deleted. Please rerun the command.');
				return;
			}

			await interaction.reply(`This server is already connected to the chat network in the channel ${connectedChannel}. Please disconnect from there first.`);
			return;
		}

		const insertChannel = {
			channelId: interaction.channel?.id,
			channelName: (interaction.channel as TextChannel)?.name,
			serverId: interaction.guild?.id,
			serverName: interaction.guild?.name,
		};

		try {
			await connectedList.insertOne(insertChannel);
			connectedList.countDocuments({}, async (error, numOfDocs) => {
				if (error) {
					logger.error(error);
				}

				if (numOfDocs && numOfDocs > 1) {
					await interaction.reply(stripIndents`
					This channel has been connected to the chat network. You are currently with ${numOfDocs} other servers, Enjoy! ${normal.clipart}
					**⚠️ This is not an __AI Chat__, but a chat network that allows you to connect to multiple servers and communicate with *__real__* members. ⚠️**`,
					);
				}
				else {
					await interaction.reply(`This channel has been connected to the chat network, though no one else is there currently... *cricket noises* ${normal.clipart}`);
				}
			});
			logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);
		}
		catch (err) {
			logger.error(err);
			await interaction.reply('An error occurred while connecting to the chat network.');
		}

		interaction.client.sendInNetwork(stripIndents`
					A new server has joined us in the Network! ${normal.clipart}

					**Server Name:** __${interaction.guild?.name}__
					**Member Count:** __${interaction.guild?.memberCount}__`,
		);
	},
};
