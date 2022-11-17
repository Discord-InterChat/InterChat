import { PrismaClient } from '@prisma/client';
import { stripIndent } from 'common-tags';
import { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, SelectMenuBuilder, GuildTextBasedChannel, RestOrArray, APIEmbedField, EmbedBuilder, ChannelType, ComponentType } from 'discord.js';
import { colors, getDb, NetworkManager } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
	async execute(interaction: ChatInputCommandInteraction, db: PrismaClient) {
		// send the initial reply
		if (!interaction.deferred) await interaction.deferReply();

		const emoji = interaction.client.emoji;
		const setupCollection = db.setup;

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
						value: 'profanity',
					},
					{
						label: 'Webhook Messages',
						emoji: emoji.icons.webhook,
						description: 'Send network messages from webhooks instead of the bot.',
						value: 'webhook',
					},
				]),
		]);

		const network = new NetworkManager();
		const setupEmbed = new SetupEmbedGenerator(interaction);

		const guildSetup = await setupCollection?.findFirst({ where: { guildId: interaction.guildId?.toString() } });
		const guildConnected = await network.getServerData({ serverId: interaction.guildId?.toString() });

		if (!guildSetup) return interaction.followUp('Server is not setup yet. Use `/setup channel` first.');
		if (!interaction.guild?.channels.cache.get(guildSetup?.channelId)) {
			setupCollection.delete({ where: { channelId: guildSetup?.channelId } });
			return await interaction.followUp('Connected channel has been deleted! Please use `/setup channel` and set a new one.');
		}

		if (!guildConnected) setupActionButtons.components.at(-1)?.setDisabled(true);


		const setupMessage = await interaction.editReply({ content: '', embeds: [await setupEmbed.default()], components: [customizeMenu, setupActionButtons] });

		// Create action row collectors
		const setupCollector = setupMessage.createMessageComponentCollector({
			filter: m => m.user.id == interaction.user.id,
			time: 60_000,
			componentType: ComponentType.Button,
		});

		const selectMenuCollector = setupMessage.createMessageComponentCollector({
			filter: m => m.user.id == interaction.user.id,
			time: 60_000,
			componentType: ComponentType.StringSelect,
		});


		selectMenuCollector.on('collect', async component => {
			// Reference multiple select menus with its 'value' (values[0])
			switch (component.customId) {
			case 'customize': {
				// get the latest db updates
				const guildInDB = await setupCollection.findFirst({ where: { guildId: interaction.guild?.id } });

				switch (component.values[0]) {
				case 'compact':
					await setupCollection?.updateMany({
						where: { guildId: interaction.guild?.id },
						data: { date:new Date(), compact: !guildInDB?.compact },
					});
					break;

				case 'profanity':
					await setupCollection?.updateMany({
						where: { guildId: interaction.guild?.id },
						data: { date: new Date(), profFilter: !guildInDB?.profFilter },
					});
					break;

				case 'webhook': {
					const connectedChannel = await interaction.client.channels.fetch(`${guildInDB?.channelId}`).catch(() => null);

					if (!connectedChannel || connectedChannel.type !== ChannelType.GuildText) {
						await component.reply({ content: 'Cannot edit setup for selected channel. If you think this is a mistake report this to the developers.', ephemeral: true });
						break;
					}

					if (guildInDB?.webhook) {
						const deleteWebhook = await connectedChannel.fetchWebhooks();
						deleteWebhook.find((webhook) => webhook.owner?.id === interaction.client.user.id)?.delete();

						await setupCollection?.update({ where: { channelId: connectedChannel.id }, data: { date: new Date(), webhook: null } });

						await component.reply({ content: 'Webhook messages have been disabled.', ephemeral: true });
						break;
					}

					const webhook = await connectedChannel.createWebhook({ name: 'ChatBot Network', avatar: interaction.client.user?.avatarURL() });

					await setupCollection?.updateMany({
						where: { guildId: interaction.guild?.id },
						data: {
							date: new Date(),
							webhook: { set: { id: webhook.id, token: `${webhook.token}`, url: webhook.url } },
						},
					},

					);
					await component.reply({ content: 'Webhook has been initialized! Messages will now be sent with webhooks.', ephemeral: true });
					break;
				}

				}
				component.replied || component.deferred ? interaction.editReply({ embeds: [await setupEmbed.default()] }) : component.update({ embeds: [await setupEmbed.default()] });
			}
			}
		});

		setupCollector.on('collect', async component => {
			switch (component.customId) {
			case 'reconnect': {
				const channel = await interaction.client.channels.fetch(String(guildSetup?.channelId))
					.catch(() => null) as GuildTextBasedChannel | null;

				if (guildConnected) {
					network.disconnect(interaction.guildId);
					logger.info(`${interaction.guild?.name} (${interaction.guildId}) has disconnected from the network.`);
				}

				await network.connect(interaction.guild, channel);
				logger.info(`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`);

				setupActionButtons.components.at(-1)?.setDisabled(false);

				component.reply({ content: 'Channel has been reconnected!', ephemeral: true });
				interaction.editReply({ embeds: [await setupEmbed.default()], components: [customizeMenu, setupActionButtons] });
				break;
			}

			case 'disconnect':
				await network.disconnect({ channelId: guildSetup.channelId });
				setupActionButtons.components.at(-1)?.setDisabled(true);

				logger.info(`${interaction.guild?.name} (${interaction.guildId}) has disconnected from the network.`);

				component.message.edit({ embeds: [await setupEmbed.default()], components: [customizeMenu, setupActionButtons] });
				component.reply({ content: 'Disconnected!', ephemeral: true });
				break;
			default:
				break;
			}
		});

		setupCollector.on('end', () => {
			interaction.editReply({ components: [] }).catch(() => null);
			return;
		});

	},
};


// Embed classes to make it easier to call and edit multiple embeds
class SetupEmbedGenerator {
	private interaction: ChatInputCommandInteraction;
	constructor(interaction: ChatInputCommandInteraction) {
		this.interaction = interaction;
	}
	async default() {
		const db = getDb();

		const guildSetupData = await db.setup.findFirst({ where: { guildId: this.interaction?.guild?.id } });
		const guild = this.interaction.client.guilds.cache.get(`${guildSetupData?.guildId}`);
		const channel = guild?.channels.cache.get(`${guildSetupData?.channelId}`);

		const emoji = this.interaction.client.emoji;

		const guildNetworkData = await db.connectedList?.findFirst({ where: { channelId : channel?.id } });
		const status = channel && guildNetworkData ? emoji.normal.yes : emoji.normal.no;
		const lastEdited = Number(guildSetupData?.date.getTime());

		const embed = new EmbedBuilder()
			.setAuthor({
				name: `${this.interaction.guild?.name} Setup`,
				iconURL: this.interaction.guild?.iconURL()?.toString(),
			})
			.addFields(
				{
					name: 'Network State',
					value: `**Connected:** ${status}\n**Channel:** ${channel}\n**Last Edited:** <t:${Math.round(lastEdited / 1000)}:R>`,
				},
				{
					name: 'Style',
					value: stripIndent`
					**Compact:** ${guildSetupData?.compact === true ? emoji.normal.enabled : emoji.normal.disabled}
					**Profanity Filter:** ${guildSetupData?.profFilter === true ? emoji.normal.enabled : emoji.normal.disabled}
					**Webhook Messages:**  ${guildSetupData?.webhook ? emoji.normal.enabled : emoji.normal.disabled}
					`,
				},
			)
			.setColor(colors('chatbot'))
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
			.setColor(colors('chatbot'))
			.addFields(...fields)
			.setThumbnail(this.interaction.guild?.iconURL() || null)
			.setTimestamp()
			.setFooter({ text: `Requested by: ${this.interaction.user.tag}`, iconURL: this.interaction.user.avatarURL()?.toString() });
		return embed;
	}
}