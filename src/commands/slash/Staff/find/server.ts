import { stripIndents } from 'common-tags';
import { type ChatInputCommandInteraction, EmbedBuilder, GuildPremiumTier } from 'discord.js';
import Constants from '#utils/Constants.js';
import db from '#utils/Db.js';
import { toTitleCase } from '#utils/Utils.js';
import Find from './index.js';

export default class Server extends Find {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hideResponse = interaction.options.getBoolean('hidden') ?? true;
    await interaction.deferReply({ ephemeral: hideResponse });

    const serverId = interaction.options.getString('server', true);
    const guild = await interaction.client.guilds.fetch(serverId).catch(() => null);
    if (!guild) {
      await interaction.editReply('Unknown Server.');
      return;
    }

    const owner = await guild?.fetchOwner();

    const guildInDb = await db.connection.findMany({
      where: { serverId: guild.id },
      include: { hub: true },
    });

    const guildBlacklisted = await db.infraction.count({
      where: { expiresAt: { gt: new Date() }, serverId: guild.id },
    });
    const guildBoostLevel = GuildPremiumTier[guild.premiumTier];

    const guildHubs =
      guildInDb.length > 0 ? guildInDb.map(({ hub }) => hub?.name).join(', ') : 'None';
    const guildConnections = guildInDb?.map(({ channelId }) => `<#${channelId}> (${channelId}))`);

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${guild.name}`,
        iconURL: guild.iconURL() || undefined,
      })
      .setDescription(guild.description || 'No Description')
      .setColor(Constants.Colors.invisible)
      .setThumbnail(guild.iconURL() || null)
      .setImage(guild.bannerURL({ size: 1024 }) || null)
      .addFields([
        {
          name: 'Server Info',
          value: stripIndents`
          > **Server ID:** ${guild.id}
          > **Owner:** @${owner.user.username} (${owner.id})
          > **Created:** <t:${Math.round(guild.createdTimestamp / 1000)}:R>
          > **Language:** ${guild.preferredLocale}
          > **Boost Level:** ${guildBoostLevel}
          > **Member Count:** ${guild.memberCount}
          > **On Shard:** ${guild.shardId}
          `,
        },

        {
          name: 'Server Features:',
          value:
            guild.features
              .map((feat) => `> ${toTitleCase(feat.replaceAll('_', ' '))}\n`)
              .join('') || `> ${this.getEmoji('x_icon')} No Features Enabled`,
        },

        {
          name: 'Network Info',
          value: stripIndents`
          > **Joined Hubs(${guildInDb.length}):** ${guildHubs}
          > **Blacklisted from:** ${guildBlacklisted} hubs
          > **Channel(s):** ${guildConnections}`,
        },
      ]);

    await interaction.editReply({
      content: guild?.id,
      embeds: [embed],
    });
  }
}
