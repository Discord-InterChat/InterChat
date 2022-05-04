/* eslint-disable no-inline-comments */
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const mongoUtil = require('../../utils');
// const logger = require('../logger/logger');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Replies with your input!')
		.addChannelOption(option => option.setName('destination').setDescription('Select a channel').setRequired(true))
		.setDefaultPermission(false),

	async execute(interaction) {
		// inside a command, event listener, etc.
		const exampleEmbed = new MessageEmbed()
			.setColor('#0099ff')
			.setTitle('Some title')
			.setURL('https://discord.js.org/')
			.setAuthor('Some name', 'https://i.imgur.com/AfFp7pu.png', 'https://discord.js.org')
			.setDescription('Some description here')
			.setThumbnail('https://i.imgur.com/AfFp7pu.png')
			.addFields(
				{ name: 'Regular field title', value: 'Some value here' },
				{ name: '\u200B', value: '\u200B' },
				{ name: 'Inline field title', value: 'Some value here', inline: true },
				{ name: 'Inline field title', value: 'Some value here', inline: true },
			)
			.addField('Inline field title', 'Some value here', true)
			.setImage('https://i.imgur.com/AfFp7pu.png')
			.setTimestamp()
			.setFooter('Some footer text here', 'https://i.imgur.com/AfFp7pu.png');

		interaction.channel.send({ embeds: [exampleEmbed] });
		const database = mongoUtil.getDb();
		const setup = database.collection('setup');
		const connectedList = database.collection('connectedList');


		const guildInDB = await setup.findOne({ 'guildId': interaction.guild.id });
		// console.log(guildInDB);
		if (guildInDB) {
			const channels = interaction.guild.channels.cache.find(channel => channel.id === guildInDB.channelId);

			if (!channels) {
				await setup.deleteOne(
					{ 'guildId': interaction.guild.id });
				activate();
				return;
			}
			interaction.reply(`This server is already setup to channel <#${guildInDB.channelId}>`);
			return;
		}


		async function activate() {
			const guild = interaction.guild;
			const category = await interaction.options.getChannel('destination');
			if (category.type != 'GUILD_CATEGORY') return await interaction.reply({ content: 'Please only choose category channels!', ephemeral: true });
			// console.log(interaction.client);
			const channel = await guild.channels.create('global-chat', {
				type: 'GUILD_TEXT',
				parent: category.id,
				position: 0,
				permissionOverwrites: [{
					type: 'member',
					id: await interaction.client.user.id,
					allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'READ_MESSAGE_HISTORY', 'MANAGE_MESSAGES', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS'],
				}],
			});

			const setupmsg = await channel.send('Setup Complete! This channel has been connected to the network! Type `/guide` to get started, or type `/support server` to join the support server for any further questions that you may have. Enjoy! <:chat_clipart:772393314413707274>');
			await setup.insertOne({
				'guildId': interaction.guild.id,
				'channelId': setupmsg.channel.id,
			});
			const insertChannel = { channelId: setupmsg.channel.id, channelName: setupmsg.channel.name, serverId: interaction.guild.id, serverName: interaction.guild.name };
			await connectedList.insertOne(insertChannel);

			// Message link format: https://discord.com/channels/${setupmsg.guildId}/${setupmsg.channelId}/${setupmsg.messageId}
			await interaction.reply({ content:`<#${setupmsg.channelId}>` });
			return;
		}
		activate().catch(console.error);
		const allConnected = await connectedList.find().toArray();
		console.table(allConnected);
	},

};

// Set bot perms for setup channel