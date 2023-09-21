import { EmbedBuilder, ChatInputCommandInteraction, Guild, GuildMember } from 'discord.js';
import { stripIndents } from 'common-tags';
import { colors, getDb, toTitleCase } from '../../Utils/misc/utils';
import emojis from '../../Utils/JSON/emoji.json';

export default {
  async execute(interaction: ChatInputCommandInteraction, serverId: string, hidden: boolean) {
    await interaction.deferReply({ ephemeral: hidden });

    const server = await interaction.client.guilds.fetch(serverId).catch(() => null);
    if (!server) return interaction.editReply('Unknown Server.');

    const owner = await server?.fetchOwner();

    await interaction.editReply({
      content: server?.id, embeds: [await embedGen(server, owner)],
    });

  },
};

async function embedGen(guild: Guild, GuildOwner: GuildMember | undefined) {
  const { blacklistedServers, connectedList } = getDb();

  const guildInDb = await connectedList.findMany({ where: { serverId: guild.id }, include: { hub: true } });
  const guildBlacklisted = await blacklistedServers.count({ where: { serverId: guild.id } });
  const guildBoostLevel = guild.premiumTier === 0
    ? 'None' : guild.premiumTier === 1
      ? 'Level 1'
      : guild.premiumTier === 2 ? 'Level 2'
        : guild.premiumTier === 3 ? 'Level 3'
          : 'Unknown';

  const { no } = emojis.normal;

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
        > **Owner:** @${GuildOwner?.user.username} (${GuildOwner?.id})
        > **Created:** <t:${Math.round(guild.createdTimestamp / 1000)}:R>
        > **Language:** ${guild.preferredLocale}
        > **Boost Level:** ${guildBoostLevel}
        > **Member Count:** ${guild.memberCount}
        `,
      },

      {
        name: 'Server Features:',
        value: guild.features.map(feat => '> ' + toTitleCase(feat.replaceAll('_', ' ')) + '\n')
          .join('') || `> ${no} No Features Enabled`,
      },

      {
        name: 'Network Info',
        value: stripIndents`
        > **Joined Hubs(${guildInDb.length}):** ${ guildInDb.map(({ hub }) => hub?.name).join(', ')}
        > **Blacklisted from:** **${guildBlacklisted} hubs
        > **Channel(s):** ${guildInDb?.map(({ channelId }) => `<#${channelId}> (${channelId}))`)}`,
      },
    ]);
}

