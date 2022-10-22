import { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, SelectMenuBuilder, GuildTextBasedChannel, RestOrArray, APIEmbedField, EmbedBuilder } from 'discord.js';
import { Collection, Document } from 'mongodb';
import { getDb, NetworkManager } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';
import { connectedListDocument } from '../../Utils/typings/types';

export = {
	async execute(interaction: ChatInputCommandInteraction, collection: Collection | undefined) {
		// send the initial reply
		if (!interaction.deferred) await interaction.deferReply();

		const emoji = interaction.client.emoji;

		const setupActionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder().setCustomId('reconnect').setStyle(ButtonStyle.Success).setLabel('Reconnect').setEmoji(emoji.icons.connect),
			new ButtonBuilder().setCustomId('disconnect').setStyle(ButtonStyle.Danger).setLabel('Disconnect').setEmoji(emoji.icons.disconnect),
		]);

		const customizeMenu = new ActionRowBuilder<SelectMenuBuilder>().addComponents([
			new SelectMenuBuilder()
				.setCustomId('customize')
				.setPlaceholder('✨ Customize Setup')
				.addOptions([
					{
						label: 'Compact Mode',
						emoji: emoji.normal.clipart,
						description: 'Disable embeds in the network to fit more messages.',
						value: 'compact',
					},

					{
						label: 'Profanity Filter',
						emoji: '🤬',
						description: 'Toggle message censoring for this server.',
						value: 'profanity_toggle',
					},
				]),
		]);

		const network = new NetworkManager();
		const setupEmbed = new SetupEmbedGenerator(interaction, collection);

		const guildSetup = await collection?.findOne({ 'guild.id': interaction.guildId });
		const guildConnected = await network.connected({ serverId: interaction.guildId });

		if (!guildSetup) return interaction.followUp('Server is not setup yet. Use `/setup channel` first.');
		if (!interaction.guild?.channels.cache.get(guildSetup?.channel.id)) {
			collection?.deleteOne({ 'channel.id': guildSetup?.channel.id });
			return await interaction.followUp('Connected channel has been deleted! Please use `/setup channel` and set a new one.');
		}

		if (!guildConnected) setupActionButtons.components.pop();


		const setupMessage = await interaction.editReply({ content: '', embeds: [await setupEmbed.default()], components: [customizeMenu, setupActionButtons] });

		// Create action row collectors
		const setupCollector = setupMessage.createMessageComponentCollector({
			filter: m => m.user.id == interaction.user.id,
			time: 60_000,
		});

		// Everything is in one collector since im lazy
		setupCollector.on('collect', async component => {
			if (component.isButton()) {
				switch (component.customId) {
				case 'reconnect': {
					const channel = await interaction.client.channels.fetch(String(guildSetup?.channel.id))
						.catch(() => {return null;}) as GuildTextBasedChannel | null;

					if (guildConnected) {
						network.disconnect(interaction.guildId);
						logger.info(`${interaction.guild?.name} (${interaction.guildId}) has disconnected from the network.`);
					}

					await network.connect(interaction.guild, channel);
					logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);

					component.reply({ content: 'Channel has been reconnected!', ephemeral: true });
					interaction.editReply({ embeds: [await setupEmbed.default()] });
					break;
				}

				case 'disconnect':
					new NetworkManager().disconnect(String(interaction.guildId));
					setupActionButtons.components.pop();

					component.message.edit({ embeds: [await setupEmbed.default()], components: [customizeMenu, setupActionButtons] });
					component.reply({ content: 'Disconnected!', ephemeral: true });
					break;
				default:
					break;
				}
			}

			// Reference multiple select menus with its 'value' (values[0])
			if (component.isSelectMenu()) {
				switch (component.customId) {
				case 'customize': {
					// get the latest db updates
					const guildInDB = await collection?.findOne({ 'guild.id': interaction.guild?.id });

					if (component.values[0] === 'compact') {
						await collection?.updateOne({ 'guild.id': interaction.guild?.id },
							{ $set: { 'date.timestamp': Math.round(new Date().getTime() / 1000), compact: !guildInDB?.compact } });
					}

					if (component.values[0] === 'profanity_toggle') {
						await collection?.updateOne({ 'guild.id': interaction.guild?.id },
							{ $set: { 'date.timestamp': Math.round(new Date().getTime() / 1000), profFilter: !guildInDB?.profFilter } });
					}
					component.update({ embeds: [await setupEmbed.default()] });
				}
				}
			}
		});

		setupCollector.on('end', () => {
			interaction.editReply({ components: [] }).catch((e) => {
				if (e.message.includes('Unkown Message')) return;
				logger.error(`[Setup] Encountered error when trying to delete components from message: ${e}`);
			});
			return;
		});

	},
};


// Embed classes to make it easier to call and edit multiple embeds
class SetupEmbedGenerator {
	private interaction: ChatInputCommandInteraction;
	private setupList: Collection | undefined;
	constructor(interaction: ChatInputCommandInteraction, setupList: Collection<Document> | undefined) {
		this.interaction = interaction;
		this.setupList = setupList;
	}
	async default() {
		const db = getDb();
		const connectedList = db?.collection('connectedList');

		const guildSetupData = await this.setupList?.findOne({ 'guild.id': this.interaction?.guild?.id });
		const guild = this.interaction.client.guilds.cache.get(guildSetupData?.guild.id);
		const channel = guild?.channels.cache.get(guildSetupData?.channel.id);

		const emoji = this.interaction.client.emoji;

		const guildNetworkData = await connectedList?.findOne({ channelId : channel?.id }) as connectedListDocument | undefined | null;
		const status = channel && guildNetworkData ? this.interaction.client.emoji.normal.yes : emoji.normal.no;


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
					value: `**Compact:** ${guildSetupData?.compact === true ? emoji.normal.enabled : emoji.normal.disabled}\n**Profanity Filter:** ${guildSetupData?.profFilter === true ? emoji.normal.enabled : emoji.normal.disabled}`,
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