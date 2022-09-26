import logger from '../../Utils/logger';
import filter from '../../Utils/functions/wordFilter';
import { stripIndents } from 'common-tags';
import { normal } from '../../Utils/emoji.json';
import { deleteChannels, NetworkManager } from '../../Utils/functions/utils';
import { ChatInputCommandInteraction } from 'discord.js';
import { Collection } from 'mongodb';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, connectedList: Collection) {
		if (filter.check(interaction.guild?.name)) {
			return interaction.reply('I have detected words in the *server name* that are potentially offensive, Please correct them before using this chat!');
		}

		const network = new NetworkManager();
		const findChannel = await connectedList.findOne({ channelId: interaction.channel?.id });
		const findServer = await connectedList.findOne({ serverId: interaction.guild?.id });

		if (findChannel) {
			await interaction.reply('This channel is already connected to the chat network.');
			return;
		}
		if (findServer) {
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

		try {
			if (!interaction.inCachedGuild()) return interaction.reply('This command only works in servers.');

			network.connect(interaction.guild, interaction.channel);
			const numOfDocs = await connectedList.countDocuments();
			if (numOfDocs && numOfDocs > 1) {
				await interaction.reply(stripIndents`
					This channel has been connected to the chat network. You are currently with ${numOfDocs} other servers, Enjoy! ${normal.clipart}
					**⚠️ This is not an __AI Chat__, but a chat network that allows you to connect to multiple servers and communicate with *__real__* members. ⚠️**`,
				);
			}
			else {
				await interaction.reply(`This channel has been connected to the chat network, though no one else is there currently... *cricket noises* ${normal.clipart}`);
			}

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
