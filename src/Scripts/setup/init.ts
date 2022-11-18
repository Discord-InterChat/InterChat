import { stripIndents } from 'common-tags';
import { ChannelType, ChatInputCommandInteraction, OverwriteType, GuildTextBasedChannel, CategoryChannel } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { NetworkManager } from '../../Structures/network';
import logger from '../../Utils/logger';

export = {
	async execute(interaction: ChatInputCommandInteraction, database: PrismaClient) {
		// send the initial reply
		await interaction.deferReply();

		const date = new Date();
		const emoji = interaction.client.emoji;

		const destination = interaction.options.getChannel('destination') as GuildTextBasedChannel | CategoryChannel;

		const setupList = database.setup;
		const guildSetup = await setupList.findFirst({ where: { guildId: interaction.guild?.id } });
		const network = new NetworkManager();

		if (guildSetup) {
			if (destination) {
				if (await setupList.findFirst({ where: { channelId: destination.id } })) {
					interaction.followUp(`A setup for ${destination} is already present.`);
					return;
				}

				await interaction.editReply('There is an existing channel setup... Change channel? (y/n)');

				const msg =	await interaction.channel?.awaitMessages({ filter: (m) => m.author.id === interaction.user.id, max: 1, idle: 10_000 });
				if (msg?.first()?.content.toLowerCase() !== 'y') return msg?.first()?.reply('Cancelled.');

				network.disconnect(interaction.guildId);
				await setupList?.deleteMany({ where: { guildId: interaction.guildId?.toString() } });
			}

			// try to fetch the channel, if it does not exist delete from the databases'
			try {
				await interaction.guild?.channels.fetch(guildSetup.channelId);
			}
			catch {
				await setupList?.delete({ where: { channelId: guildSetup.channelId } });
				network.disconnect({ channelId: guildSetup.channelId });
			}
		}

		if (!destination) return interaction.editReply('Please specify a channel destination first!');
		let channel;

		if (destination.type === ChannelType.GuildCategory) {
			// Make a channel if destination is a category
			try {
				channel = await interaction.guild?.channels.create({
					name: 'global-chat',
					type: ChannelType.GuildText,
					parent: destination,
					position: 0,
					permissionOverwrites: [{
						type: OverwriteType.Member,
						id: String(interaction.guild?.members.me?.id),
						allow: [
							'ViewChannel',
							'SendMessages',
							'ManageMessages',
							'EmbedLinks',
							'AttachFiles',
							'ReadMessageHistory',
							'ManageMessages',
							'AddReactions',
							'UseExternalEmojis',
						],
					}],
				});
			}
			catch {
				interaction.editReply(`${emoji.normal.no} Please make sure I have the following permissions: \`Manage Channels\`, \`Manage Roles\` for this command to work!`);
				return;
			}
		}

		else {channel = destination;}


		try {
			// Inserting channel to setup and connectedlist
			await network.connect(interaction.guild, channel);
			await setupList?.create({
				data: {
					guildId: String(interaction.guild?.id),
					channelId: String(channel?.id),
					date: date,
					compact: false,
					profFilter: true,
					webhook: null,
				},
			});

			const numOfConnections = await network.totalConnected();
			if (numOfConnections && numOfConnections > 1) {
				await channel?.send(stripIndents`
						This channel has been connected to the chat network. You are currently with ${numOfConnections} other servers, Enjoy! ${emoji.normal.clipart}
						**⚠️ This is not an __AI Chat__, but a chat network that allows you to connect to multiple servers and communicate with *__real__* members. ⚠️**`);
			}
			else {
				await channel?.send(stripIndents`
				This channel has been connected to the chat network, though no one else is there currently... *cricket noises* ${emoji.normal.clipart}
				**⚠️ This is not an __AI Chat__, but a chat network that allows you to connect to multiple servers and communicate with *__real__* members. ⚠️**`);
			}
			logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		catch (err: any) {
			logger.error(err);
			await interaction.followUp('An error occurred while connecting to the chat network.\n**Error:** ' + err.message);
			setupList?.delete({ where: { channelId: channel?.id } });
			network.disconnect(interaction.guild?.id as string);
			return;
		}

		interaction.client.sendInNetwork(stripIndents`
			A new server has joined us in the Network! ${emoji.normal.clipart}

			**Server Name:** __${interaction.guild?.name}__
			**Member Count:** __${interaction.guild?.memberCount}__`);

		(await import('./displayEmbed')).execute(interaction, database);
	},
};