import { stripIndents } from 'common-tags';
import { ChannelType, ChatInputCommandInteraction, OverwriteType, GuildTextBasedChannel, CategoryChannel } from 'discord.js';
import { Collection } from 'mongodb';
import { NetworkManager } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
	async execute(interaction: ChatInputCommandInteraction, setupList: Collection | undefined, destination: GuildTextBasedChannel | CategoryChannel | undefined) {
		// send the initial reply
		await interaction.deferReply();

		const date = new Date();
		const timestamp = Math.round(date.getTime() / 1000);
		const emoji = interaction.client.emoji;

		const guildSetup = await setupList?.findOne({ 'guild.id': interaction.guild?.id });
		const network = new NetworkManager();

		if (guildSetup) {
			if (destination) {
				if (await setupList?.findOne({ 'channel.id': destination.id })) {
					interaction.followUp(`A setup for ${destination} is already present.`);
					return;
				}

				await interaction.editReply('There is an existing channel setup... Change channel? (y/n)');

				const msg =	await interaction.channel?.awaitMessages({ filter: (m) => m.author.id === interaction.user.id, max: 1, idle: 10_000 });
				if (msg?.first()?.content.toLowerCase() !== 'y') return msg?.first()?.reply('Cancelled.');

				network.disconnect(interaction.guildId);
				await setupList?.deleteMany({ 'guild.id': interaction.guildId });
			}

			// try to fetch the channel, if it does not exist delete from the databases'
			try {
				await interaction.guild?.channels.fetch(guildSetup.channel.id);
			}
			catch {
				await setupList?.deleteOne({ 'channel.id': guildSetup.channel.id });
				network.disconnect({ channelId: String(guildSetup.channel.id) });
				interaction.editReply(emoji.icons.exclamation + ' Uh-Oh! The channel I have been setup to does not exist or is private.');
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
			await setupList?.insertOne({
				guild: { name: interaction.guild?.name, id: interaction.guild?.id },
				channel: { name: channel?.name, id: channel?.id },
				date: { full: date, timestamp: timestamp },
				compact: false,
				profFilter: true,
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
			setupList?.deleteOne({ 'channel.id': channel?.id });
			network.disconnect(interaction.guild?.id as string);
			return;
		}

		interaction.client.sendInNetwork(stripIndents`
			A new server has joined us in the Network! ${emoji.normal.clipart}

			**Server Name:** __${interaction.guild?.name}__
			**Member Count:** __${interaction.guild?.memberCount}__`);

		(await import('./displayEmbed')).execute(interaction, setupList);
	},
};