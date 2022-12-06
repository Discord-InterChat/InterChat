import { EmbedBuilder, ChatInputCommandInteraction, Guild, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { stripIndents } from 'common-tags';
import { checkIfStaff, colors, getDb, toTitleCase } from '../../Utils/functions/utils';

export = {
	async execute(interaction: ChatInputCommandInteraction, serverId: string, hidden: boolean) {
		await interaction.deferReply({ ephemeral: hidden });

		const server = await interaction.client.guilds.fetch(serverId).catch(() => null);
		if (!server) return interaction.editReply('Unknown Server.');

		const owner = await server?.fetchOwner();

		const db = getDb();
		const blacklistedServers = db?.blacklistedServers;

		const components = async () => {
			const guildBlacklisted = await blacklistedServers?.findFirst({
				where: {
					serverId: server.id,
				},
			});

			return new ActionRowBuilder<ButtonBuilder>({
				components: [
					new ButtonBuilder({
						customId: guildBlacklisted ? 'unblacklist' : 'blacklist',
						label: guildBlacklisted ? 'Unblacklist' : 'Blacklist',
						style: guildBlacklisted ? ButtonStyle.Success : ButtonStyle.Danger,
					}),
					new ButtonBuilder({
						customId: 'leave',
						label: 'Leave Server',
						style: ButtonStyle.Primary,
					}),
				],
			});
		};

		const initalMessage = await interaction.editReply({
			content: server?.id, embeds: [await embedGen(server, owner)], components: [await components()],
		});

		const collector = initalMessage.createMessageComponentCollector({
			filter: async (i) => i.user.id === interaction.user.id && await checkIfStaff(i.client, i.user),
			componentType: ComponentType.Button,
		});

		collector.on('collect', async (i) => {
			switch (i.customId) {
				case 'blacklist':
					await blacklistedServers?.create({
						data: {
							serverName: server.name,
							serverId: server.id,
							reason: 'Some Reason',
						},
					});
					await i.update({ embeds: [await embedGen(server, owner)], components: [await components()] });
					i.followUp({ content: 'Server blacklisted.', ephemeral: hidden });
					break;
				case 'unblacklist':
					await blacklistedServers?.delete({ where: { serverId: server.id } });
					await i.update({ embeds: [await embedGen(server, owner)], components: [await components()] });
					i.followUp({ content: 'Server removed from blacklist.', ephemeral: hidden });
					break;
				case 'leave':
					i.reply({ content: 'Leaving Server....', ephemeral: hidden });
					await server.leave();
					break;
				default:
					break;
			}
		});
	},
};

async function embedGen(guild: Guild, GuildOwner: GuildMember | undefined) {
	const database = getDb();

	const guildInDb = await database.connectedList.findFirst({ where: { serverId: guild.id } });
	const guildInSetup = await database.setup.findFirst({ where: { guildId: guild.id } });
	const guildBlacklisted = await database.blacklistedServers.findFirst({ where: { serverId: guild.id } });
	const guildBoostLevel = guild.premiumTier === 0 ? 'None' : guild.premiumTier === 1 ? 'Level 1' : guild.premiumTier === 2 ? 'Level 2' : guild.premiumTier === 3 ? 'Level 3' : 'Unknown';

	const emojis = guild.client.emoji;
	const channelName = await guild.client.channels.fetch(String(guildInDb?.channelId)).catch(() => null);

	return new EmbedBuilder()
		.setAuthor({ name: `${guild.name}`, iconURL: guild.iconURL() || undefined })
		.setDescription(guild.description || 'No Description')
		.setColor(colors('invisible'))
		.setThumbnail(guild.iconURL() || null)
		.setImage(guild.bannerURL({ size: 1024 }) || null)
		.addFields([
			{
				name: 'Server Info',
				value: stripIndents`
				> **Server ID:** ${guild.id}
				> **Owner:** ${GuildOwner?.user.tag} (${GuildOwner?.id})
				> **Created:** <t:${Math.round(guild.createdTimestamp / 1000)}:R>
				> **Language:** ${guild.preferredLocale}
				> **Boost Level:** ${guildBoostLevel}
				> **Member Count:** ${guild.memberCount}
				`,
			},

			{
				name: 'Server Features:',
				value: guild.features.map(feat => '> ' + toTitleCase(feat.replaceAll('_', ' ')) + '\n').join('') || `> ${emojis.normal.no} No Features`,
			},

			{
				name: 'Network Info',
				value: stripIndents`
				> **Connected: ${guildInDb ? 'Yes' : 'No'}**
				> **Setup:** ${guildInSetup ? 'Yes' : 'No'}
				> **Blacklisted:** ${guildBlacklisted ? 'Yes' : 'No'}
				> **Channel(s):** ${guildInDb ? `${channelName} (${guildInDb?.channelId})` : 'Not Connected'}`,
			},
		]);
}

