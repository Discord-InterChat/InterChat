'use strict';
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChatInputCommandInteraction, APIEmbedField, RestOrArray, ChannelType, CacheType } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import emoji from '../../Utils/emoji.json';
import logger from '../../Utils/logger';
import { Collection, Document } from 'mongodb';
import { connectedListInterface } from '../../Utils/typings/types';

export interface Embeds {
	default(): Promise<EmbedBuilder>
	customFields(fields: RestOrArray<APIEmbedField>): EmbedBuilder
}

export default {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Set me up to receive messages from a channel.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
		.setDMPermission(false)
		.addChannelOption((channelOption) =>
			channelOption
				.setName('destination')
				.setDescription('Channel you want to setup chatbot to, select a category to create a new channel for chatbot')
				.setRequired(false)
				.addChannelTypes(
					ChannelType.GuildText,
					ChannelType.GuildCategory,
					ChannelType.PublicThread,
					ChannelType.PrivateThread,
				),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		// Declare
		// FIXME: Dont send setupList and connectedList as a parameter. As it will lead to big problems if the data in the DB changes!
		const database = getDb();
		const setupList = database?.collection('setup');
		const connectedList = database?.collection('connectedList');

		const setupEmbeds = new SetupEmbedGenerator(interaction, setupList);

		// send the initial reply
		await interaction.deferReply({ fetchReply: true });


		// collectors and main setup function
		(await import('../../Scripts/setup/init')).execute(interaction, setupEmbeds, setupList, connectedList).catch(logger.error);
		(await import('../../Scripts/setup/components')).execute(interaction, setupList, setupEmbeds, connectedList).catch(logger.error);
	},
};


// Embed classes to make it easier to call and edit multiple embeds
class SetupEmbedGenerator {
	interaction: ChatInputCommandInteraction;
	setupList: Collection | undefined;
	constructor(interaction: ChatInputCommandInteraction<CacheType>, setupList: Collection<Document> | undefined) {
		this.interaction = interaction;
		this.setupList = setupList;
	}
	async default() {
		const db = getDb();
		const connectedList = db?.collection('connectedList');

		const guildSetupData = await this.setupList?.findOne({ 'guild.id': this.interaction?.guild?.id });
		const guild = this.interaction.client.guilds.cache.get(guildSetupData?.guild.id);
		const channel = guild?.channels.cache.get(guildSetupData?.channel.id);


		const guildNetworkData = await connectedList?.findOne({ channelId : channel?.id }) as connectedListInterface | undefined | null;
		const status = channel && guildNetworkData ? emoji.normal.yes : emoji.normal.no;


		const embed = new EmbedBuilder()
			.setAuthor({
				name: `${this.interaction.client.user?.username.toString()} Setup`,
				iconURL: this.interaction.client.user?.avatarURL()?.toString(),
			})
			.addFields(
				{
					name: 'Network State',
					value: `**Connected:** ${status}\n**Channel:** ${channel}\n**Last Edited:** <t:${guildSetupData?.date.timestamp}:R>`,
				},
				{
					name: 'Style',
					value: `**Compact:** ${guildSetupData?.compact === true ? emoji.normal.enabled : emoji.normal.disabled}\n**Profanity Filter:** ${guildSetupData?.profFilter === true ? emoji.normal.force_enabled : emoji.normal.force_enabled}`,
				},
			)
			.setColor('#3eb5fb')
			.setThumbnail(this.interaction.guild?.iconURL() || null)
			.setTimestamp()
			.setFooter({
				text: this.interaction.user.tag,
				iconURL: this.interaction.user.avatarURL() as string,
			});

		return embed;
	}
	customFields(fields: RestOrArray<APIEmbedField>) {
		const embed = new EmbedBuilder()
			.setAuthor({ name: this.interaction.guild?.name as string, iconURL: this.interaction.guild?.iconURL()?.toString() })
			.setColor('#3eb5fb')
			.addFields(...fields)
			.setThumbnail(this.interaction.guild?.iconURL() || null)
			.setTimestamp()
			.setFooter({ text: `Requested by: ${this.interaction.user.tag}`, iconURL: this.interaction.user.avatarURL()?.toString() });
		return embed;
	}
}