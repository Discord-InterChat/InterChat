import { stripIndents } from 'common-tags';
import { ButtonBuilder, ActionRowBuilder, ButtonStyle, ChannelType, ChatInputCommandInteraction, Message, TextChannel, OverwriteType } from 'discord.js';
import { Collection } from 'mongodb';
import emoji from '../../Utils/emoji.json';
import logger from '../../Utils/logger';

export = {
	async execute(interaction: ChatInputCommandInteraction, embeds: any, message: Message, setupList: Collection, connectedList: Collection) {
		// Buttons
		const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder().setCustomId('edit').setLabel('edit').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId('reset').setLabel('reset').setStyle(ButtonStyle.Danger),
		]);

		const date = new Date();
		const timestamp = Math.round(date.getTime() / 1000);

		const guildInDB = await setupList.findOne({ 'guild.id': interaction.guild?.id });
		const destination = interaction.options.getChannel('destination');
		const connectedGuild = await connectedList.findOne({ serverId: interaction.guild?.id });

		if (destination && connectedGuild) {
			return interaction.editReply(
				`${emoji.normal.no} This server is already connected to <#${connectedGuild.channelId}>! Please disconnect from there first.`,
			);
		}


		// If channel is in database display the setup embed
		if (guildInDB) {

			if (destination) {
				return interaction.editReply(`${emoji.normal.no} This server is already setup! Use the command without the \`destination\` option, or **reset** the setup if you wish to redo it.`);
			}

			// try to fetch the channel, if it does not exist delete from the databases'
			try {
				await interaction.guild?.channels.fetch(guildInDB.channel.id);
			}
			catch {
				await setupList.deleteOne({ 'channel.id': guildInDB.channel.id });
				await connectedList.deleteOne({ 'channelId': guildInDB.channel.id });
				return message.edit(emoji.icons.exclamation + ' Uh-Oh! The channel I have been setup to does not exist or is private.');
			}
		}

		else {
			if (!destination) return message.edit('Please specify a channel destination first!');

			let channel = destination as TextChannel | undefined;

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
							id: interaction.guild?.members.me?.id as string,
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
					return message.edit(`${emoji.normal.no} Please make sure I have the following permissions: \`Manage Channels\`, \`Manage Users\` for this command to work!`);
				}
			}

			channel?.send('**⚠️ This is not an __AI Chat__, but a chat network that allows you to connect to multiple servers and communicate with *__real__* members. ⚠️**');

			try {
				// Inserting channel to setup and connectedlist
				await setupList.insertOne({
					guild: { name: interaction.guild?.name, id: interaction.guild?.id },
					channel: { name: channel?.name, id: channel?.id },
					date: { full: date, timestamp: timestamp },
					compact: false,
					profFilter: true,
				});

				await connectedList.insertOne({
					channelId: channel?.id,
					channelName: channel?.name,
					serverId: interaction.guild?.id,
					serverName: interaction.guild?.name,
				});
				connectedList.countDocuments({}, async (error, numOfDocs) => {
					if (error) {
						logger.error(error);
					}

					if (numOfDocs && numOfDocs > 1) {
						await channel?.send(stripIndents`
						This channel has been connected to the chat network. You are currently with ${numOfDocs} other servers, Enjoy! ${emoji.normal.clipart}
						**⚠️ This is not an __AI Chat__, but a chat network that allows you to connect to multiple servers and communicate with *__real__* members. ⚠️**`,
						);
					}
					else {
						await channel?.send(`This channel has been connected to the chat network, though no one else is there currently... *cricket noises* ${emoji.normal.clipart}`);
					}
				});
				logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);
			}
			catch (err) {
				logger.error(err);
				await interaction.reply('An error occurred while connecting to the chat network.');
			}

			interaction.client.sendInNetwork(stripIndents`
			A new server has joined us in the Network! ${emoji.normal.clipart}

			**Server Name:** __${interaction.guild?.name}__
			**Member Count:** __${interaction.guild?.memberCount}__`);
		}

		message.edit({ content: null, embeds: [await embeds.setDefault()], components: [buttons] });
	},
};