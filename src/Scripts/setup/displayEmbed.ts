import { PrismaClient } from '@prisma/client';
import { stripIndent } from 'common-tags';
import { ChatInputCommandInteraction, ButtonBuilder, ActionRowBuilder, ButtonStyle, GuildTextBasedChannel, RestOrArray, APIEmbedField, EmbedBuilder, ChannelType, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, Interaction } from 'discord.js';
import { NetworkManager } from '../../Structures/network';
import { colors, getDb } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';

export = {
	async execute(interaction: ChatInputCommandInteraction, db: PrismaClient) {
		if (!interaction.deferred) await interaction.deferReply();

		const emoji = interaction.client.emoji;
		const setupCollection = db.setup;

		const setupActionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder()
				.setCustomId('reconnect')
				.setStyle(ButtonStyle.Success)
				.setLabel('Reconnect')
				.setEmoji(emoji.icons.connect),
			new ButtonBuilder()
				.setCustomId('disconnect')
				.setStyle(ButtonStyle.Danger)
				.setLabel('Disconnect')
				.setEmoji(emoji.icons.disconnect),
		]);

		const customizeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
			new StringSelectMenuBuilder()
				.setCustomId('customize')
				.setPlaceholder('🛠️ Change Settings')
				.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel('Compact Mode')
						.setEmoji({ name: 'chat_clipart', id: '772393314413707274' })
						.setDescription('Disable embeds in the network to fit more messages.')
						.setValue('compact'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Profanity Filter')
						.setEmoji({ name: '🤬' })
						.setDescription('Toggle swear word censoring for this server.')
						.setValue('profanity'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Webhooks')
						.setEmoji({ name: 'webhook', id: '1037323777643651104' })
						.setDescription('Network messages will be sent using webhooks instead.')
						.setValue('webhook'),
				),
		]);


		const network = new NetworkManager();
		const setupEmbed = new SetupEmbedGenerator(interaction);

		const guildSetup = await setupCollection.findFirst({ where: { guildId: interaction.guild?.id } });
		const guildConnected = await network.getServerData({ serverId: interaction.guild?.id });

		if (!guildSetup) return interaction.followUp(`${emoji.normal.no} Server is not setup yet. Use \`/setup channel\` first.`);
		if (!interaction.guild?.channels.cache.get(guildSetup?.channelId)) {
			await setupCollection.delete({ where: { channelId: guildSetup?.channelId } });
			return await interaction.followUp(`${emoji.normal.no} Network channel not found. Use \`/setup channel\` to set a new one.`);
		}

		if (!guildConnected) setupActionButtons.components.at(-1)?.setDisabled(true);

		const setupMessage = await interaction.editReply({
			content: '',
			embeds: [await setupEmbed.default()],
			components: [customizeMenu, setupActionButtons],
		});

		const filter = (m: Interaction) => m.user.id === interaction.user.id;
		const buttonCollector = setupMessage.createMessageComponentCollector({
			filter,
			time: 60_000,
			componentType: ComponentType.Button,
		});

		const selectCollector = setupMessage.createMessageComponentCollector({
			filter,
			idle: 60_000,
			componentType: ComponentType.StringSelect,
		});

		selectCollector.on('collect', async (component) => {
			const guildInDB = await setupCollection.findFirst({ where: { guildId: interaction.guild?.id } });

			switch (component.values[0]) {
			case 'compact':
				await setupCollection?.updateMany({
					where: { guildId: interaction.guild?.id },
					data: { date: new Date(), compact: !guildInDB?.compact },
				});
				break;

			case 'profanity':
				await setupCollection?.updateMany({
					where: { guildId: interaction.guild?.id },
					data: { date: new Date(), profFilter: !guildInDB?.profFilter },
				});
				break;

			case 'webhook': {
				const connectedChannel = await interaction.client.channels
					.fetch(`${guildInDB?.channelId}`)
					.catch(() => null);

				if (!connectedChannel || connectedChannel.type !== ChannelType.GuildText) {
					await component.reply({
						content: 'Cannot edit setup for selected channel. If you think this is a mistake report this to the developers.',
						ephemeral: true,
					});
					break;
				}

				if (guildInDB?.webhook) {
					const deleteWebhook = await connectedChannel.fetchWebhooks();
					deleteWebhook
						.find((webhook) => webhook.owner?.id === interaction.client.user.id)
						?.delete();

					await setupCollection?.update({
						where: { channelId: connectedChannel.id },
						data: { date: new Date(), webhook: null },
					});

					await component.reply({
						content: 'Webhook messages have been disabled.',
						ephemeral: true,
					});
					break;
				}
				await component.reply({
					content: `${emoji.normal.loading} Creating webhook...`,
					ephemeral: true,
				});

				const webhook = await connectedChannel.createWebhook({
					name: 'ChatBot Network',
					avatar: interaction.client.user?.avatarURL(),
				});


				await component.editReply(`${emoji.normal.loading} Initializing & saving webhook data...`);
				await setupCollection?.updateMany({
					where: { guildId: interaction.guild?.id },
					data: {
						date: new Date(),
						webhook: { set: { id: webhook.id, token: `${webhook.token}`, url: webhook.url } },
					},
				});
				await component.editReply(`${emoji.normal.yes} Webhooks have been ssuccessfully setup!`);
				break;
			}
			}
			component.replied || component.deferred
				? interaction.editReply({ embeds: [await setupEmbed.default()] })
				: component.update({ embeds: [await setupEmbed.default()] });
		});

		buttonCollector.on('collect', async (component) => {
			switch (component.customId) {
			case 'reconnect': {
				const channel = (await interaction.client.channels
					.fetch(String(guildSetup?.channelId))
					.catch(() => null)) as GuildTextBasedChannel | null;

				if (guildConnected) {
					network.disconnect(interaction.guildId);
					logger.info(
						`${interaction.guild?.name} (${interaction.guildId}) has disconnected from the network.`,
					);
				}

				await network.connect(interaction.guild, channel);
				logger.info(
					`${interaction.guild?.name} (${interaction.guildId}) has joined the network.`,
				);

				setupActionButtons.components.at(-1)?.setDisabled(false);

				component.reply({ content: 'Channel has been reconnected!', ephemeral: true });
				interaction.editReply({
					embeds: [await setupEmbed.default()],
					components: [customizeMenu, setupActionButtons],
				});
				break;
			}

			case 'disconnect':
				await network.disconnect({ channelId: guildSetup.channelId });
				setupActionButtons.components.at(-1)?.setDisabled(true);

				logger.info(
					`${interaction.guild?.name} (${interaction.guildId}) has disconnected from the network.`,
				);

				component.message.edit({
					embeds: [await setupEmbed.default()],
					components: [customizeMenu, setupActionButtons],
				});
				component.reply({ content: 'Disconnected!', ephemeral: true });
				break;
			default:
				break;
			}
		});

		selectCollector.on('end', () => {
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
		const emoji = this.interaction.client.emoji;

		const guildSetupData = await db.setup.findFirst({ where: { guildId: this.interaction?.guild?.id } });
		const guild = this.interaction.client.guilds.cache.get(`${guildSetupData?.guildId}`);
		const channel = guild?.channels.cache.get(`${guildSetupData?.channelId}`);
		const guildNetworkData = await new NetworkManager().getServerData({ channelId: channel?.id });

		// option enabled/disabled emojis
		const status = channel && guildNetworkData ? emoji.normal.yes : emoji.normal.no;
		const compact = guildSetupData?.compact ? emoji.normal.enabled : emoji.normal.disabled;
		const profanity = guildSetupData?.profFilter ? emoji.normal.enabled : emoji.normal.disabled;
		const webhook = guildSetupData?.webhook ? emoji.normal.enabled : emoji.normal.disabled;
		const lastEditedTimestamp = Math.round(Number(guildSetupData?.date.getTime()) / 1000);


		return new EmbedBuilder()
			.setAuthor({
				name: `${this.interaction.guild?.name} Setup`,
				iconURL: this.interaction.guild?.iconURL()?.toString(),
			})
			.addFields(
				{
					name: 'Network State',
					value: stripIndent`
					**Connected:** ${status}
					**Channel:** ${channel}
					**Last Edited:** <t:${lastEditedTimestamp}:R>
					`,
				},
				{
					name: 'Style',
					value: stripIndent`
					**Compact:** ${compact}
					**Profanity Filter:** ${profanity}
					**Webhook Messages:**  ${webhook}
					`,
				},
			)
			.setColor(colors('chatbot'))
			.setThumbnail(this.interaction.guild?.iconURL() || null)
			.setTimestamp()
			.setFooter({
				text: this.interaction.user.tag,
				iconURL: this.interaction.user.avatarURL() ?? this.interaction.user.defaultAvatarURL,
			});
	}
	customFields(fields: RestOrArray<APIEmbedField>) {
		return new EmbedBuilder()
			.setColor(colors('chatbot'))
			.addFields(...fields)
			.setThumbnail(this.interaction.guild?.iconURL() || null)
			.setTimestamp()
			.setAuthor({
				name: this.interaction.guild?.name as string,
				iconURL: this.interaction.guild?.iconURL()?.toString(),
			})
			.setFooter({
				text: `Requested by: ${this.interaction.user.tag}`,
				iconURL: this.interaction.user.avatarURL() ?? this.interaction.user.defaultAvatarURL,
			});
	}
}
