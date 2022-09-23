import { stripIndents } from 'common-tags';
import { ButtonBuilder, ActionRowBuilder, ButtonStyle, ChannelType, ChatInputCommandInteraction, OverwriteType, GuildTextBasedChannel, CategoryChannel, SelectMenuBuilder } from 'discord.js';
import { Collection } from 'mongodb';
import { Embeds } from '../../Commands/Main/setup';
import emoji from '../../Utils/emoji.json';
import logger from '../../Utils/logger';

export = {
	async execute(interaction: ChatInputCommandInteraction, embeds: Embeds, setupList: Collection | undefined, connectedList: Collection | undefined) {
		// Buttons
		const networkActionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder().setCustomId('reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId('reconnect').setStyle(ButtonStyle.Success).setLabel('Reconnect').setEmoji(emoji.icons.connect),
			new ButtonBuilder().setCustomId('disconnect').setStyle(ButtonStyle.Success).setLabel('Disconnect').setEmoji(emoji.icons.disconnect),
		]);


		const customizeMenu = new ActionRowBuilder<SelectMenuBuilder>().addComponents([
			new SelectMenuBuilder()
				.setCustomId('customize')
				.setPlaceholder('✨ Customize Setup')
				.addOptions([
					{
						label: 'Compact',
						emoji: emoji.icons.message,
						description: 'Disable embeds in the network to fit more messages.',
						value: 'compact',
					},

					{
						label: 'Profanity Filter',
						emoji: emoji.icons.info,
						description: 'Disable profanity filter for this server. (Unavailable as of now)', // TODO - Add profanity filter toggling
						value: 'profanity_toggle',
					},
				]),
		]);

		const date = new Date();
		const timestamp = Math.round(date.getTime() / 1000);

		const guildSetup = await setupList?.findOne({ 'guild.id': interaction.guild?.id });
		const destination = interaction.options.getChannel('destination') as GuildTextBasedChannel | CategoryChannel | undefined;
		let guildConnected = await connectedList?.findOne({ serverId: interaction.guild?.id });

		if (destination && guildConnected) {
			return interaction.editReply(`${emoji.normal.no} This server is already connected to <#${guildConnected.channelId}>! Please disconnect from there first.`);
		}


		// If channel is in database display the setup embed
		if (guildSetup) {
			if (destination) {
				interaction.editReply(`${emoji.normal.no} This server is already setup! Use the command without the \`destination\` option, or **reset** the setup if you wish to redo it.`);
				return;
			}

			// try to fetch the channel, if it does not exist delete from the databases'
			try {
				await interaction.guild?.channels.fetch(guildSetup.channel.id);
			}
			catch {
				await setupList?.deleteOne({ 'channel.id': guildSetup.channel.id });
				await connectedList?.deleteOne({ 'channelId': guildSetup.channel.id });
				// TODO: make a setup view command or something?
				return interaction.editReply(emoji.icons.exclamation + ' Uh-Oh! The channel I have been setup to does not exist or is private.');
			}
		}

		else {
			if (!destination) return interaction.editReply('Please specify a channel destination first!');
			let channel;

			if (destination.type === ChannelType.GuildCategory) {
				// Make a channel if destination is a category
				try {
					channel = await interaction.guild?.channels.create({
						name: 'global-chat',
						type: ChannelType.GuildText,
						parent: destination.id,
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
				await setupList?.insertOne({
					guild: { name: interaction.guild?.name, id: interaction.guild?.id },
					channel: { name: channel?.name, id: channel?.id },
					date: { full: date, timestamp: timestamp },
					compact: false,
					profFilter: true,
				});

				await connectedList?.insertOne({
					channelId: channel?.id,
					channelName: channel?.name,
					serverId: interaction.guild?.id,
					serverName: interaction.guild?.name,
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
			catch (err) {
				logger.error(err);
				await interaction.followUp('An error occurred while connecting to the chat network.');
			}

			interaction.client.sendInNetwork(stripIndents`
			A new server has joined us in the Network! ${emoji.normal.clipart}

			**Server Name:** __${interaction.guild?.name}__
			**Member Count:** __${interaction.guild?.memberCount}__`);
		}

		guildConnected = await connectedList?.findOne({ serverId: interaction.guild?.id });
		if (!guildConnected) networkActionButtons.components.pop();
		interaction.followUp({ embeds: [await embeds.default()], components: [customizeMenu, networkActionButtons] });

	},
};