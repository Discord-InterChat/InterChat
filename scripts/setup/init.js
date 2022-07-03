const { CommandInteraction, MessageButton, Message, ChannelManager, GuildChannel, ThreadChannel } = require('discord.js');
const { Embeds } = require('../../commands/Main/setup');
const emoji = require('../../emoji.json');

module.exports = {
	/**
	 * @param {CommandInteraction} interaction
	 * @param {GuildChannel} destination
	 * @param {MessageButton} buttons
	 * @param {Embeds} embeds
	 * @param {Message} message
	 * @returns
	 */
	async execute(interaction, destination, buttons, embeds, guildInDB, message, collection, connectedList) {
		const date = new Date();
		const timestamp = Math.round(date.getTime() / 1000);
		const defaultEmbed = embeds.setDefault();
		const default_msg = ({ content: null, embeds: [defaultEmbed], components: [buttons] });
		const serverConnected = await connectedList.findOne({ serverId: interaction.guild.id });

		// if guild is already setup
		if (destination && guildInDB) {
			return interaction.editReply(
				`${emoji.normal.no} This server is already setup! Please do not use the \`destination\` option or reset the setup if you wish to redo it. `,
			);
		}

		if (destination && serverConnected) {
			return interaction.editReply(
				`${emoji.normal.no} This server is already connected to <#${serverConnected.channelId}>! Please disconnect from there first. `,
			);
		}

		if (!guildInDB) {
			if (!destination) return message.edit('Please specify a channel destination first!');

			// If channel type is category create a channel inside it
			if (destination.type == 'GUILD_CATEGORY') {
				// Make a channel if it doesn't exist
				let channel;
				try {
					channel = await interaction.guild.channels.create('global-chat', {
						type: 'GUILD_TEXT',
						parent: destination.id,
						position: 0,
						permissionOverwrites: [{
							type: 'member',
							id: interaction.client.user.id,
							allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'READ_MESSAGE_HISTORY', 'MANAGE_MESSAGES', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS'],
						}],
					});
				}
				catch (e) {
					return message.edit(`${emoji.normal.no} Please make sure I have the following permissions: \`Manage Channels\`, \`Manage Permissions\` for this command to work!`);
				}

				// Inserting the newly created channel to setup and connectedlist
				await collection.insertOne({
					guild: { name: interaction.guild.name, id: interaction.guild.id },
					channel: { name: channel.name, id: channel.id },
					date: { full: date, timestamp: timestamp },
					compact: false,
					profFilter: true,
				});
				await connectedList.insertOne({
					'channelId': channel.id,
					'channelName': channel.name,
					'serverId': interaction.guild.id,
					'serverName': interaction.guild.name,
				});
				return message.edit(default_msg);
			}

			// insert data into setup & connectedList database
			await collection.insertOne({
				guild: { name: interaction.guild.name, id: interaction.guild.id },
				channel: { name: destination.name, id: destination.id },
				date: { full: date, timestamp: timestamp },
				compact: false,
				profFilter: true,
			});

			await connectedList.insertOne({
				'channelId': destination.id,
				'channelName': destination.name,
				'serverId': interaction.guild.id,
				'serverName': interaction.guild.name,
			});
			message.edit(default_msg);
		}

		// If channel is in database display the setup embed
		guildInDB = await collection.findOne({ 'guild.id': interaction.guild.id }); // fetch again to get updated data (VERY IMPORTANT)
		if (guildInDB) {
			// try to fetch the channel, if it does not exist delete from the databases'
			try {
				await interaction.guild.channels.fetch(guildInDB.channel.id);
			}
			catch {
				await collection.deleteOne({ 'channel.id': guildInDB.channel.id });
				await connectedList.deleteOne({ 'channelId': guildInDB.channel.id });
				return message.edit(emoji.icons.exclamation + ' Uh-Oh! The channel I have been setup to does not exist or is private.');
			}
			message.edit(default_msg);
		}
	},
};