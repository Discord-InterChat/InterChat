import { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, SelectMenuBuilder, GuildTextBasedChannel, RestOrArray, APIEmbedField, EmbedBuilder } from 'discord.js';
import { Collection, Document } from 'mongodb';
import { getDb, NetworkManager } from '../../Utils/functions/utils';
import emoji from '../../Utils/emoji.json';
import logger from '../../Utils/logger';
import { connectedListDocument } from '../../Utils/typings/types';

export = {
	async execute(interaction: ChatInputCommandInteraction, collection: Collection | undefined, connectedList: Collection | undefined) {
		const setupEmbedGenerator = new SetupEmbedGenerator(interaction, collection);

		const setupActionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder().setCustomId('reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId('reconnect').setStyle(ButtonStyle.Success).setLabel('Reconnect').setEmoji(emoji.icons.connect),
			new ButtonBuilder().setCustomId('disconnect').setStyle(ButtonStyle.Success).setLabel('Disconnect').setEmoji(emoji.icons.disconnect),
		]);

		const choiceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder().setCustomId('yes').setLabel('Yes').setStyle(ButtonStyle.Success),
			new ButtonBuilder().setCustomId('no').setLabel('No').setStyle(ButtonStyle.Danger),
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
						description: 'Toggle Swear censoring for this server.', // TODO - Add profanity filter toggling
						value: 'profanity_toggle',
					},
				]),
		]);

		const network = new NetworkManager();
		const guildSetup = await collection?.findOne({ 'guild.id': interaction.guildId });
		const guildConnected = await network.connected({ serverId: interaction.guildId });


		if (!interaction.guild?.channels.cache.get(guildSetup?.channel.id)) {
			collection?.deleteOne({ 'channel.id': guildSetup?.channel.id });
			return await interaction.followUp('Connected channel has been deleted! Please use `/setup channel` and set a new one.');
		}

		if (!guildConnected) setupActionButtons.components.pop();
		if (!guildSetup) return interaction.followUp('Server is not setup yet. Use `/setup channel` first.');

		const setupMessage = await interaction.followUp({ embeds: [await setupEmbedGenerator.default()], components: [customizeMenu, setupActionButtons] });

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
					interaction.editReply({ embeds: [await setupEmbedGenerator.default()] });
					break;
				}

				case 'disconnect':
					new NetworkManager().disconnect(String(interaction.guildId));
					setupActionButtons.components.pop();

					component.reply({ content: 'Disconnected!', ephemeral: true });
					interaction.editReply({ embeds: [await setupEmbedGenerator.default()], components: [customizeMenu, setupActionButtons] });
					break;


				case 'reset': {
					try {
						const resetConfirmMsg = await interaction.followUp({
							content: `${emoji.icons.info} Are you sure? You will have to re-setup to use the network again! All data will be lost.`,
							components: [choiceButtons],
						});
						component.update({ components: [] });

						const resetCollector = resetConfirmMsg.createMessageComponentCollector({
							filter: (m) => m.user.id == interaction.user.id,
							idle: 10_000,
							max: 1,
						});

						// Creating collector for yes/no button
						resetCollector.on('collect', async (collected) => {
							if (collected.customId === 'yes') {
								await collection?.deleteOne({ 'guild.id': interaction.guild?.id });
								await connectedList?.deleteOne({ serverId: interaction.guild?.id });
								collected.update({
									content: `${emoji.normal.yes} Successfully reset.`,
									components: [],
								});
							}
							else {
								collected.message.delete();
							}
							return;
						});
					}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					catch (e: any) {
						component.update({
							content: `${emoji.icons.exclamation} ${e.message}!`,
							embeds: [],
							components: [],
						});
					}
				}
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
					component.update({ embeds: [await setupEmbedGenerator.default()] });
				}
				}
			}
		});

		setupCollector.on('end', () => {
			interaction.editReply({ components: [] });
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


		const guildNetworkData = await connectedList?.findOne({ channelId : channel?.id }) as connectedListDocument | undefined | null;
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