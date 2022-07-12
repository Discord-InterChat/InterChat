const { stripIndents } = require('common-tags');
const { CommandInteraction, MessageButton, Message, MessageActionRow } = require('discord.js');
const { Collection } = require('mongodb');
const { Embeds } = require('../../commands/Main/setup');
const emoji = require('../../emoji.json');

module.exports = {
	/**
	 * @param {CommandInteraction} interaction
	 * @param {Embeds} embeds
	 * @param {Message} message
	 * @param {Collection} collection
	 * @param {Collection} connectedList
	 * @returns
	 */
	async execute(interaction, embeds, message, setupList, connectedList) {
		// Buttons
		const buttons = new MessageActionRow().addComponents([
			new MessageButton().setCustomId('edit').setLabel('edit').setStyle('SECONDARY'),
			new MessageButton().setCustomId('reset').setLabel('reset').setStyle('DANGER'),
		]);

		const date = new Date();
		const timestamp = Math.round(date.getTime() / 1000);

		const guildInDB = await setupList.findOne({ 'guild.id': interaction.guild.id });
		const destination = interaction.options.getChannel('destination');
		const connectedGuild = await connectedList.findOne({ serverId: interaction.guild.id });
		const allConnectedChannels = connectedList.find({});

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
				await interaction.guild.channels.fetch(guildInDB.channel.id);
			}
			catch {
				await setupList.deleteOne({ 'channel.id': guildInDB.channel.id });
				await connectedList.deleteOne({ 'channelId': guildInDB.channel.id });
				return message.edit(emoji.icons.exclamation + ' Uh-Oh! The channel I have been setup to does not exist or is private.');
			}
		}

		else {
			if (!destination) return message.edit('Please specify a channel destination first!');

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
				catch {
					return message.edit(`${emoji.normal.no} Please make sure I have the following permissions: \`Manage Channels\`, \`Manage Users\` for this command to work!`);
				}

				// Inserting the newly created channel to setup and connectedlist
				await setupList.insertOne({
					guild: { name: interaction.guild.name, id: interaction.guild.id },
					channel: { name: channel.name, id: channel.id },
					date: { full: date, timestamp: timestamp },
					compact: false,
					profFilter: true,
				});

				await connectedList.insertOne({
					channelId: channel.id,
					channelName: channel.name,
					serverId: interaction.guild.id,
					serverName: interaction.guild.name,
				});
				await allConnectedChannels.forEach(channelEntry => {
					interaction.client.channels.fetch(channelEntry.channelId).then(async chan => {
						await chan.send(stripIndents`
							A new server has joined us in the Network! ${emoji.normal.clipart}
		
							**Server Name:** __${interaction.guild.name}__
							**Member Count:** __${interaction.guild.memberCount}__`);

					});
				});
				return message.edit({ content: null, embeds: [await embeds.setDefault()], components: [buttons] });
			}

			// insert data into setup & connectedList database if it is not a category
			await setupList.insertOne({
				guild: { name: interaction.guild.name, id: interaction.guild.id },
				channel: { name: destination.name, id: destination.id },
				date: { full: date, timestamp: timestamp },
				compact: false,
				profFilter: true,
			});

			await connectedList.insertOne({
				channelId: destination.id,
				channelName: destination.name,
				serverId: interaction.guild.id,
				serverName: interaction.guild.name,
			});

			await allConnectedChannels.forEach(channelEntry => {
				interaction.client.channels.fetch(channelEntry.channelId).then(async chan => {
					await chan.send(stripIndents`
						A new server has joined us in the Network! ${emoji.normal.clipart}
	
						**Server Name:** __${interaction.guild.name}__
						**Member Count:** __${interaction.guild.memberCount}__`);

				});
			});
		}

		message.edit({ content: null, embeds: [await embeds.setDefault()], components: [buttons] });
	},
};