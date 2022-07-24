'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../../utils');
const emoji = require('../../emoji.json');
const logger = require('../../logger');


module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Set me up to receive messages from a channel.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) // REVIEW: Importing this from discord.js now it was discord-api-typs/v10 before
		.addChannelOption(channelOption => channelOption
			.setName('destination')
			.setRequired(false)
			.setDescription('Channel you want to setup chatbot to, select a category to create a new channel for chatbot')), // .addChannelTypes(Constants.ChannelTypes.GUILD_CATEGORY))

	/**
	* @param {import 'discord.js'.ChatInputCommandInteraction} interaction
	*/
	async execute(interaction) {
		// Embed classes to make it easier to call and edit multiple embeds
		class Embeds {
			constructor() { /**/ }
			async setDefault() {
				const db_guild = await setupList.findOne({ 'guild.id': interaction.guild.id });
				const guildd = interaction.client.guilds.cache.get(db_guild?.guild.id);
				const channel = guildd?.channels.cache.get(db_guild?.channel.id);

				const embed = new EmbedBuilder()
					.setAuthor({ name: interaction.client.user.username, iconURL: interaction.client.user.avatarURL() })
					.setTitle('This server is setup!')
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
			setCustom(fields) {
				const embed = new EmbedBuilder()
					.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
					.setColor('#3eb5fb')
					.addFields(fields)
					.setThumbnail(interaction.guild.iconURL())
					.setTimestamp()
					.setFooter({ text: `Requested by: ${interaction.user.tag}`, iconURL: interaction.user.avatarURL() });
				return embed;
			}
		}

		// export the Embeds class to use as a type in other files
		module.exports.Embeds = Embeds;

		// Declare
		const database = getDb();
		const setupList = database.collection('setup');
		const connectedList = database.collection('connectedList');

		const embeds = new Embeds();

		// Send the initial message
		await interaction.reply({ content: `${emoji.normal.loading} Please wait...` });
		const message = await interaction.fetchReply(); // Maybe consider using interaction.editReply() (add fetchReply: true in the initial reply)

		// collectors and main setup function
		require('../../scripts/setup/init').execute(interaction, embeds, message, setupList, connectedList).catch(logger.error);
		require('../../scripts/setup/components').execute(interaction, message, setupList, embeds, connectedList).catch(logger.error);
	},
};

