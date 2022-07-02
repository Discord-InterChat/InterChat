'use strict';
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, CommandInteraction } = require('discord.js');
const { getDb } = require('../../utils');
const emoji = require('../../emoji.json');
const { PermissionFlagsBits } = require('discord-api-types/v10');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Replies with your input!')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
		.addChannelOption(channelOption => channelOption
			.setName('destination')
			.setRequired(false)
			.setDescription('Channel you want to setup chatbot to, select a category to create a new channel for chatbot')), // .addChannelTypes(Constants.ChannelTypes.GUILD_CATEGORY))

	/**
	* @param {CommandInteraction} interaction
	*/
	async execute(interaction) {
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
	 		* @param {import('discord.js').EmbedField} fields Set embed Fields use the arrays inside objects to add multiple
	 		* @returns
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
				{ label: 'Message Style', emoji: '<:dot:981763271994523658>', description: 'Customize the way message sent by ChatBot looks.', value: 'message_style' },
				{ label: 'Profanity Filter', emoji: '<:dot:981763271994523658>', description: 'Enable and disabled profanity filter for this server.', value: 'profanity_toggle' },
			]),
		]);


		// export the Embeds class to use as a type in other files
		module.exports.Embeds = Embeds;

		// Declare
		const database = getDb();
		const collection = database.collection('setup');

		const connectedList = database.collection('connectedList');

		const destination = interaction.options.getChannel('destination');
		const embeds = new Embeds();

		let embed;
		const db_guild = await collection.findOne({ 'guild.id': interaction.guild.id }); // collection.fineOne returns promise to be sure to await it

		// Send the initial message
		await interaction.reply({ content: `${emoji.normal.loading} Please wait...` });

		// Fetching the sent message and calling setup function
		const message = await interaction.fetchReply();

		// collectors and main setup function
		require('../../scripts/setup/init').execute(interaction, destination, buttons, embeds, db_guild, message, collection, connectedList).catch(console.error);
		require('../../scripts/setup/collectors').execute(interaction, message, db_guild, collection, embed, embeds, selectMenu, connectedList, buttonYesNo).catch(console.error);
	},
};

