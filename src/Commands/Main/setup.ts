'use strict';
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import emoji from '../../Utils/emoji.json';
import logger from '../../Utils/logger';
import { Collection } from 'mongodb';

// Embed classes to make it easier to call and edit multiple embeds
export class Embeds {
	interaction: ChatInputCommandInteraction;
	setupList?: Collection;
	constructor(interaction: ChatInputCommandInteraction, setupList?: Collection) {
		this.interaction = interaction;
		this.setupList = setupList;
	}

	async setDefault() {
		const db_guild = await this.setupList?.findOne({ 'guild.id': this.interaction?.guild?.id });
		const guildd = this.interaction.client.guilds.cache.get(db_guild?.guild.id);
		const channel = guildd?.channels.cache.get(db_guild?.channel.id);

		const embed = new EmbedBuilder()
			.setAuthor({ name: this.interaction.client.user?.username.toString() as string, iconURL: this.interaction.client.user?.avatarURL()?.toString() })
			.setTitle('This server is setup!')
			.setDescription(`Channel: ${ channel || 'Unknown' }`)
			.setColor('#3eb5fb')
			.setThumbnail(this.interaction.guild?.iconURL() as string)
			.setFooter({ text: this.interaction.user.tag, iconURL: this.interaction.user.avatarURL() as string })
			.setTimestamp();

		return embed;
	}
	setCustom(fields: {name: string, value: string}) {
		const embed = new EmbedBuilder()
			.setAuthor({ name: this.interaction.guild?.name as string, iconURL: this.interaction.guild?.iconURL()?.toString() })
			.setColor('#3eb5fb')
			.addFields(fields)
			.setThumbnail(this.interaction.guild?.iconURL() as string)
			.setTimestamp()
			.setFooter({ text: `Requested by: ${this.interaction.user.tag}`, iconURL: this.interaction.user.avatarURL()?.toString() });
		return embed;
	}
}

export default {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Set me up to receive messages from a channel.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
		.setDMPermission(false)
		.addChannelOption(channelOption => channelOption
			.setName('destination')
			.setRequired(false)
			.setDescription('Channel you want to setup chatbot to, select a category to create a new channel for chatbot')), // .addChannelTypes(Constants.ChannelTypes.GUILD_CATEGORY))

	async execute(interaction: ChatInputCommandInteraction) {
		// TODO: Add disconnect and reconnect buttons to the setup.js page
		// Declare
		const database = getDb();
		const setupList = database?.collection('setup');
		const connectedList = database?.collection('connectedList');

		const embeds = new Embeds(interaction, setupList);

		// Send the initial message
		await interaction.reply({ content: `${emoji.normal.loading} Please wait...` });
		const message = await interaction.fetchReply(); // Maybe consider using interaction.editReply() (add fetchReply: true in the initial reply)

		// collectors and main setup function
		require('../../Scripts/setup/init').execute(interaction, embeds, message, setupList, connectedList).catch(logger.error);
		require('../../Scripts/setup/components').execute(interaction, message, setupList, embeds, connectedList).catch(logger.error);
	},
};

