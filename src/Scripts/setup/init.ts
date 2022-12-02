import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, GuildTextBasedChannel } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { NetworkManager } from '../../Structures/network';
import logger from '../../Utils/logger';
import displayEmbed from './displayEmbed';

export = {
	async execute(interaction: ChatInputCommandInteraction, database: PrismaClient) {
		await interaction.deferReply();

		const date = new Date();
		const emoji = interaction.client.emoji;

		const destination = interaction.options.getChannel('destination') as GuildTextBasedChannel;

		const setupList = database.setup;
		const guildSetup = await setupList.findFirst({ where: { guildId: interaction.guild?.id } });
		const network = new NetworkManager();

		if (!destination) return interaction.editReply('Please specify a channel destination first!');

		if (guildSetup) {
			if (await setupList.findFirst({ where: { channelId: destination.id } })) {
				interaction.followUp(`${destination} is already setup. Did you mean to use \`/setup view\`?`);
				return;
			}

			await interaction.editReply('This server is already setup to another channel. Change channel? (y/n)');

			const msg = await interaction.channel?.awaitMessages({
				filter: (m) => m.author.id === interaction.user.id,
				max: 1,
				idle: 10_000,
			});
			if (msg?.first()?.content.toLowerCase() !== 'y') return msg?.first()?.reply('Cancelled.');

			network.disconnect(interaction.guildId);
			await setupList?.deleteMany({ where: { guildId: interaction.guild?.id } });
		}

		try {
			// Inserting channel to setup and connectedlist
			await network.connect(interaction.guild, destination);
			await setupList?.create({
				data: {
					guildId: String(interaction.guild?.id),
					channelId: String(destination?.id),
					date: date,
					compact: false,
					profFilter: true,
					webhook: null,
				},
			});

			const numOfConnections = await network.totalConnected();
			if (numOfConnections > 1) {
				await destination?.send(stripIndents`
						This channel has been connected to the chat network. You are currently with ${numOfConnections} other servers, Enjoy! ${emoji.normal.clipart}
						**⚠️ This is not an __AI Chat__, but a chat network that allows you to connect to multiple servers and communicate with *__real__* members. ⚠️**`);
			}
			else {
				await destination?.send(stripIndents`
				This channel has been connected to the chat network, though no one else is there currently... *cricket noises* ${emoji.normal.clipart}
				**⚠️ This is not an __AI Chat__, but a chat network that allows you to connect to multiple servers and communicate with *__real__* members. ⚠️**`);
			}
			logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		catch (err: any) {
			if (err.message === 'Missing Permissions' || err.message === 'Missing Access') {
				return interaction.reply('I don\'t have the required permissions and/or access to the channel in this server to execute this command.');
			}
			logger.error(err);
			interaction.followUp('An error occurred while connecting to the chat network.\n**Error:** ' + err.message);
			await setupList?.delete({ where: { channelId: destination?.id } });
			network.disconnect(interaction.guild?.id as string);
			return;
		}

		interaction.client.sendInNetwork(stripIndents`
			A new server has joined us in the Network! ${emoji.normal.clipart}

			**Server Name:** __${interaction.guild?.name}__
			**Member Count:** __${interaction.guild?.memberCount}__`);

		displayEmbed.execute(interaction, database);
	},
};