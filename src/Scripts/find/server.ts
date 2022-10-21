import { EmbedBuilder, ChatInputCommandInteraction, Guild, GuildMember } from 'discord.js';
import { stripIndents } from 'common-tags';
import { colors, getDb } from '../../Utils/functions/utils';

export = {
	async execute(interaction: ChatInputCommandInteraction, serverId: string, hidden: boolean) {
		await interaction.deferReply({ ephemeral: hidden });
		const server: Guild | undefined = interaction.client.guilds.cache.get(serverId);
		if (!server) return interaction.followUp('Unknown Server.');

		const owner = await server?.fetchOwner();

		const embed = await embedGen(server, owner);


		await interaction.editReply({ content: server?.id, embeds: [embed] });
	},
};

async function embedGen(guild: Guild, GuildOwner: GuildMember | undefined) {
	const database = getDb();
	const connectedList = database?.collection('connectedList');
	const setupList = database?.collection('setup');
	const blacklistedServers = database?.collection('blacklistedServers');

	const guildInDb = await connectedList?.findOne({ serverId: guild.id });
	const guildInSetup = await setupList?.findOne({ 'guild.id': guild.id });
	const guildBlacklisted = await blacklistedServers?.findOne({ serverId: guild.id });

	const guildBoostLevel = guild.premiumTier === 0 ? 'None' : guild.premiumTier === 1 ? 'Level 1' : guild.premiumTier === 2 ? 'Level 2' : guild.premiumTier === 3 ? 'Level 3' : 'Unknown';

	const emojis = guild.client.emoji;

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
				value: guild.features.map(feat => '> ' + feat.replaceAll('_', ' ').toTitleCase() + '\n').join('') || `> ${emojis.normal.no} No Features`,
			},

			{
				name: 'Network Info',
				value: stripIndents`
				> **Connected: ${guildInDb ? 'Yes' : 'No'}**
				> **Setup:** ${guildInSetup ? 'Yes' : 'No'}
				> **Blacklisted:** ${guildBlacklisted ? 'Yes' : 'No'}
				> **Channel(s):** ${guildInDb ? `${guildInDb?.channelName} (${guildInDb?.channelId})` : 'Not Connected'}`,
			},
		]);
}

