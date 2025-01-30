import { stripIndents } from 'common-tags';
import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { HubService } from '#src/services/HubService.js';
import { fetchUserData } from '#src/utils/Utils.js';
import Constants from '#utils/Constants.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import type Context from '#src/core/CommandContext/Context.js';
import BaseCommand from '#src/core/BaseCommand.js';

export default class FindUserSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'user',
      description: 'Get information on a user on discord.',
      staffOnly: true,
      types: { slash: true, prefix: true },
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'user',
          description: 'The username (if they\'ve used the bot within 24h) or user ID',
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
    const userId = ctx.options.getString('user', true);
    const user = await ctx.client.users.fetch(userId).catch(() => null);
    if (!user) {
      const embed = new InfoEmbed().setDescription(
        `${ctx.getEmoji('x_icon')} Unknown user. Try using user\`s ID instead if you used username.`,
      );
      await ctx.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }

    const userData = await fetchUserData(user.id);
    const blacklistList = await db.infraction.findMany({
      where: { userId: user.id, status: 'ACTIVE', type: 'BLACKLIST' },
      select: { hub: { select: { name: true } } },
    });

    const blacklistedFromStr =
      blacklistList && blacklistList.length > 0
        ? blacklistList.map((bl) => bl.hub.name).join(', ')
        : 'None';

    const serversOwned = user.client.guilds.cache
      .filter((guild) => guild.ownerId === user.id)
      .map((guild) => guild.name);

    const ownedHubs = await new HubService().getOwnedHubs(user.id);
    const numServersOwned = serversOwned.length > 0 ? serversOwned.join(', ') : 'None';
    const numHubOwned =
      ownedHubs.length > 0 ? ownedHubs.map((hub) => hub.data.name).join(', ') : 'None';

    const embed = new EmbedBuilder()
      .setAuthor({ name: user.username, iconURL: user.avatarURL()?.toString() })
      .setColor(Constants.Colors.invisible)
      .setImage(user.bannerURL({ size: 1024 }) || null)
      .setThumbnail(user.avatarURL())
      .addFields([
        {
          name: 'User',
          value: stripIndents`
            > ${ctx.getEmoji('id')} **ID:** ${user.id}
            > ${ctx.getEmoji('mention')} **Username:** ${user.username}
            > ${ctx.getEmoji('members')} **Created:** <t:${Math.round(user.createdTimestamp / 1000)}:R>
            > ${ctx.getEmoji('bot')} **Bot:** ${user.bot}
            > ${ctx.getEmoji('owner')} **Servers Owned:** ${numServersOwned}
            `,
        },
        {
          name: 'Network',
          value: stripIndents`
            > ${ctx.getEmoji('chat_icon')} **Hubs Owned:** ${numHubOwned}
            > ${ctx.getEmoji('delete')} **Blacklisted From:** ${blacklistedFromStr}
            > ${ctx.getEmoji('deleteDanger_icon')} **Banned:** ${userData?.banReason ? 'Yes' : 'No'}
             `,
        },
      ]);

    await ctx.reply({
      content: user.id,
      embeds: [embed],
      ephemeral: hideResponse,
    });
  }
}
