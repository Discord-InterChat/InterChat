import { stripIndents } from 'common-tags';
import { ApplicationCommandOptionType, EmbedBuilder, GuildPremiumTier } from 'discord.js';
import Constants from '#utils/Constants.js';
import db from '#utils/Db.js';
import { toTitleCase } from '#utils/Utils.js';
import type Context from '#src/core/CommandContext/Context.js';
import BaseCommand from '#src/core/BaseCommand.js';

export default class Server extends BaseCommand {
  constructor() {
    super({
      name: 'server',
      description: 'Get information on a server that InterChat has access to.',
      staffOnly: true,
      types: { slash: true, prefix: true },
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'server',
          description: 'The server name or ID.',
          required: true,
          autocomplete: true,
        },
        {
          type: ApplicationCommandOptionType.Boolean,
          name: 'hidden',
          description: 'The response will be hidden for others. (Default: True)',
        },
      ],

    });
  }
  async execute(ctx: Context): Promise<void> {
    const hideResponse = ctx.options.getBoolean('hidden') ?? true;
    await ctx.deferReply({ flags: hideResponse ? ['Ephemeral'] : undefined });

    const serverId = ctx.options.getString('server', true);
    const guild = await ctx.client.guilds.fetch(serverId).catch(() => null);
    if (!guild) {
      await ctx.editReply('Unknown Server.');
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
              .join('') || `> ${ctx.getEmoji('x_icon')} No Features Enabled`,
        },

        {
          name: 'Network Info',
          value: stripIndents`
          > **Joined Hubs(${guildInDb.length}):** ${guildHubs}
          > **Blacklisted from:** ${guildBlacklisted} hubs
          > **Channel(s):** ${guildConnections}`,
        },
      ]);

    await ctx.editReply({
      content: guild?.id,
      embeds: [embed],
    });
  }
}
