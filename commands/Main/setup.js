'use strict';
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, Modal } = require('discord.js');
const logger = require('../../logger');
const { getDb } = require('../../utils');
const emoji = require('../../emoji.json');
const { PermissionFlagsBits } = require('discord-api-types/v10');
const { stripIndent } = require('common-tags');

module.exports = {
	example: stripIndent`
	
	`,
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Replies with your input!')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels | PermissionFlagsBits.KickMembers)
		.addChannelOption(channelOption => channelOption
			.setName('destination')
			.setRequired(false)
			.setDescription('Channel you want to setup chatbot to, select a category to create a new channel for chatbot')), // .addChannelTypes(Constants.ChannelTypes.GUILD_CATEGORY))

	async execute(interaction) {

		// Create Action Rows
		const buttons = new MessageActionRow().addComponents([
			new MessageButton().setCustomId('edit').setLabel('edit').setStyle('SECONDARY'),
			new MessageButton().setCustomId('reset').setLabel('reset').setStyle('DANGER'),
		]);
		const buttonYesNo = new MessageActionRow().addComponents([
			new MessageButton().setCustomId('yes').setLabel('Yes').setStyle('SUCCESS'),
			new MessageButton().setCustomId('no').setLabel('No').setStyle('DANGER'),
		]);
		const selectMenu = new MessageActionRow().addComponents([
			new MessageSelectMenu().setCustomId('customize').setPlaceholder('Customize Setup').addOptions([
				{ label: 'Message Style', emoji: '<:dot:981763271994523658>', description: 'Customize the way message sent by ChatBot looks', value: 'message_style' },
			]),
		]);

		// Embed classes to make it easier to call and edit multiple embeds
		class Embeds {
			constructor() { /**/ }
			setDefault() {
				const guildd = interaction.client.guilds.cache.get(db_guild?.guild.id);
				const channel = guildd?.channels.cache.get(db_guild?.channel.id);

				const embed = new MessageEmbed()
					.setAuthor({ name: interaction.client.user.username, iconURL: interaction.client.user.avatarURL() })
					.setTitle(`${emoji.normal.yes} Everything is setup!`)
					.setDescription(`Channel: ${ channel || 'Unknown' }`)
					.setColor('#3eb5fb')
					.setThumbnail(interaction.guild.iconURL())
					.setFooter({ text: interaction.user.tag, iconURL: interaction.user.avatarURL() })
					.setTimestamp();

				return embed;
			}

			/**
			 * @param {String} description The embed Description
			 * @param {Array} fields Set embed Fields use the arrays inside objects to add multiple
			 * @returns {MessageEmbed} Returns normal discord Embed in json format
			 */
			setCustom(description, fields) {
				const embed = new MessageEmbed()
					.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.avatarURL() })
					.setColor('#3eb5fb')
					.addFields(fields)
					.setThumbnail(interaction.guild.iconURL())
					.setTimestamp()
					.setFooter({ text: interaction.client.user.username, iconURL: interaction.client.user.avatarURL() });

				if (description !== '' || description !== ' ') embed.setDescription(description); // If description is provided, set description and vice versa
				return embed;
			}
		}

		// Declare
		const database = getDb();
		const collection = database.collection('setup');

		const connectedList = database.collection('connectedList');

		const destination = interaction.options.getChannel('destination');
		const embeds = new Embeds();

		let embed;
		let db_guild = await collection.findOne({ 'guild.id': interaction.guild.id }); // collection.fineOne returns promise to be sure to await it
		let db_guild_channel;


		// Send the initial message
		await interaction.reply({ content: `${emoji.interaction.loading} Please wait...` });

		// Fetching the sent message and calling setup function
		const message = await interaction.fetchReply();
		setup().catch(console.error);


		// Create action row collectors
		const filter = m => m.user.id == interaction.user.id;
		const collector = message.createMessageComponentCollector({ filter, idle: 60000, max: 4 });

		// NOTE: Everything is in one collector since im lazy to create multiple collectors
		collector.on('collect', async i => {
			i.deferUpdate();

			// NOTE: Use i.customId to reference differnt buttons
			if (i.isButton()) {
				db_guild = await collection.findOne({ 'guild.id': interaction.guild.id });

				if (i.customId == 'edit') {
					db_guild_channel = await interaction.guild.channels.fetch(db_guild.channel.id);
					// Setting the fields for the embed
					const fields = [
						{ name: 'Details:', value: `**Status:** ${emoji.normal.yes}\n**Channel:** ${db_guild_channel}\n**Changed:** <t:${db_guild.date.timestamp}:R>` },
						{ name: '**Style:**', value: `**Embeds:** ${db_guild.isEmbed}` },
					];
					// calling 'Embeds' class and setting fields
					embed = embeds.setCustom('', fields);
					message.edit({ embeds: [embed], components: [selectMenu] });
				}
				if (i.customId == 'reset') {
					try {
						const msg = await message.reply({ content: `${emoji.interaction.info} Are you sure? This will disconnect all connected channels and reset the setup. The channel itself will remain though. `, components: [buttonYesNo] });
						message.edit({ components: [] });


						const msg_collector = msg.createMessageComponentCollector({ filter: m => m.user.id == interaction.user.id, idle: 60000, max: 1 });

						// Creating collector for yes/no button
						msg_collector.on('collect', async collected => {
							if (collected.customId === 'yes') {
								await collection.deleteOne({ 'guild.id': interaction.guild.id });
								await connectedList.deleteOne({ 'serverId': interaction.guild.id });
								return msg.edit({ content: `${emoji.normal.yes} Successfully reset setup`, components: [] });
							}
							msg.edit({ content: `${emoji.normal.no} Cancelled`, components: [] });
							return;
						});
					}
					catch (e) {
						message.edit({ content: `${emoji.interaction.exclamation} ${ e.message}!`, embeds: [], components: [] });
						logger.error(e);
					}
				}
			}

			// NOTE: Reference multiple select menus with its 'customId`. or use'value' if you are feeling special .-.
			if (i.isSelectMenu()) {
				if (i.customId == 'customize') {
					// NOTE: The reason why i'm calling db_guild over and over is to get the latest db updates, this might create problems later though.
					db_guild = await collection.findOne({ 'guild.id': interaction.guild.id });
					db_guild_channel = await interaction.guild.channels.fetch(db_guild.channel.id);

					// NOTE: This checks If isEmbed value is true in databse
					if (db_guild && db_guild.isEmbed == true) {
						await collection.updateOne({ 'guild.id': interaction.guild.id }, { $set: { 'date.timestamp': Math.round(new Date().getTime() / 1000), isEmbed: false } });
						db_guild = await collection.findOne({ 'guild.id': interaction.guild.id });

						embed.spliceFields(1, 1, { name: '**Style:**', value: `Embeds: ${db_guild.isEmbed}` });
						message.edit({ embeds: [embed] });
						return;
					}
					else if (db_guild && db_guild.isEmbed == false) {
						await collection.updateOne({ 'guild.id': interaction.guild.id }, { $set: { 'date.timestamp': Math.round(new Date().getTime() / 1000), isEmbed: true } });
						db_guild = await collection.findOne({ 'guild.id': interaction.guild.id });

						embed.spliceFields(1, 1, { name: '**Style:**', value: `Embeds: ${db_guild.isEmbed}` });
						message.edit({ embeds: [embed] });
						return;
					}
				}
			}

		});

		// removing components from message, idk how to disable them so...
		collector.on('end', () => {
			message.edit({ components: [] })
				.catch(() => console.log('Interaction deleted, ignoring...'));
			return;
		});

		// Make Functions
		async function setup() {
			const date = new Date();
			const timestamp = Math.round(date.getTime() / 1000);
			const defaultEmbed = embeds.setDefault();
			const default_msg = ({ content: null, embeds: [defaultEmbed], components: [buttons] });

			/**
			 * -  ✅ If guild isn't in the database create channel and store that channel into database
			 * -  Send error to channel if chatbot doesnt have the required permissions!
			 */

			if (!db_guild) {
				// return if server is not setup and user did not specify setup destination
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
					await collection.insertOne({ guild: { name: interaction.guild.name, id: interaction.guild.id }, channel: { name: channel.name, id: channel.id }, date: { full: date, timestamp: timestamp }, isEmbed: true });
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
					isEmbed: true,
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
			db_guild = await collection.findOne({ 'guild.id': interaction.guild.id }); // fetch again to get updated data (VERY IMPORTANT)
			if (db_guild) {
				// try to fetch the channel, if it does not exist delete from the databases'
				try {
					db_guild_channel = await interaction.guild.channels.fetch(db_guild.channel.id);
				}
				catch {
					await collection.deleteOne({ 'channel.id': db_guild.channel.id });
					await connectedList.deleteOne({ 'channelId': db_guild.channel.id });
					return message.edit(emoji.interaction.exclamation + ' Uh-Oh! The channel I have been setup to does not exist or is private.');
				}
				message.edit(default_msg);
			}
		}

		// TODO: Clean up code

	},
};
