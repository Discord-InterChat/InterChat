import { stripIndents } from 'common-tags';
import { ChannelType, ChatInputCommandInteraction, OverwriteType, GuildTextBasedChannel, CategoryChannel } from 'discord.js';
import { Collection } from 'mongodb';
import emoji from '../../Utils/emoji.json';
import { NetworkManager } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
	async execute(interaction: ChatInputCommandInteraction, setupList: Collection | undefined, connectedList: Collection | undefined, destination: GuildTextBasedChannel | CategoryChannel | undefined) {
		const date = new Date();
		const timestamp = Math.round(date.getTime() / 1000);

		const guildSetup = await setupList?.findOne({ 'guild.id': interaction.guild?.id });
		const network = new NetworkManager();

		if (guildSetup) {
			if (destination) {
				if (await setupList?.findOne({ 'channel.id': destination.id })) {
					await interaction.followUp({ content: `A setup for ${destination} is already present`, ephemeral: true });
					return;
				}

				network.disconnect(interaction.guildId);
				setupList?.deleteMany({ 'guild.id': interaction.guildId });
				// TODO: Add more buttons asking for confirmation :)
				await interaction.followUp('Found already setup channel... Re-setting to new channel.');
			}

			// try to fetch the channel, if it does not exist delete from the databases'
			try {
				await interaction.guild?.channels.fetch(guildSetup.channel.id);
			}
			catch {
				await setupList?.deleteOne({ 'channel.id': guildSetup.channel.id });
				network.disconnect({ channelId: String(guildSetup.channel.id) });
				await connectedList?.deleteOne({ 'channelId': guildSetup.channel.id });
				// TODO: make a /setup view command?
				return interaction.editReply(emoji.icons.exclamation + ' Uh-Oh! The channel I have been setup to does not exist or is private.');
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

			const numOfConnections = await connectedList?.countDocuments();
			if (numOfConnections && numOfConnections > 1) {
				await channel?.send(stripIndents`
						This channel has been connected to the chat network. You are currently with ${numOfConnections} other servers, Enjoy! ${emoji.normal.clipart}
						**⚠️ This is not an __AI Chat__, but a chat network that allows you to connect to multiple servers and communicate with *__real__* members. ⚠️**`,
				);
			}
			else {
				await channel?.send(`This channel has been connected to the chat network, though no one else is there currently... *cricket noises* ${emoji.normal.clipart}\n**⚠️ This is not an __AI Chat__, but a chat network that allows you to connect to multiple servers and communicate with *__real__* members. ⚠️**`);
			}
			logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		catch (err: any) {
			logger.error(err);
			await interaction.followUp('An error occurred while connecting to the chat network.\n**Error:** ' + err.message);
			return network.disconnect(interaction.guild?.id as string);
		}

		interaction.client.sendInNetwork(stripIndents`
			A new server has joined us in the Network! ${emoji.normal.clipart}

			**Server Name:** __${interaction.guild?.name}__
			**Member Count:** __${interaction.guild?.memberCount}__`);

		// FIXME: Define embeds class in components.ts

		(await import('./components')).execute(interaction, setupList, connectedList);
	},
};