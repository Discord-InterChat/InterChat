import { stripIndents } from 'common-tags';
import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { HubService } from '#main/services/HubService.js';
import Constants from '#utils/Constants.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import Find from './index.js';

export default class Server extends Find {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hideResponse = interaction.options.getBoolean('hidden') ?? true;
    const userId = interaction.options.getString('user', true);
    const user = await interaction.client.users.fetch(userId).catch(() => null);
    if (!user) {
      const embed = new InfoEmbed().setDescription(
        `${this.getEmoji('x_icon')} Unknown user. Try using user\`s ID instead if you used username.`,
      );
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }

    const userData = await interaction.client.userManager.getUser(user.id);
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
            > ${this.getEmoji('id')} **ID:** ${user.id}
            > ${this.getEmoji('mention')} **Username:** ${user.username}
            > ${this.getEmoji('members')} **Created:** <t:${Math.round(user.createdTimestamp / 1000)}:R>
            > ${this.getEmoji('bot')} **Bot:** ${user.bot}
            > ${this.getEmoji('owner')} **Servers Owned:** ${numServersOwned}
            `,
        },
        {
          name: 'Network',
          value: stripIndents`
            > ${this.getEmoji('chat_icon')} **Hubs Owned:** ${numHubOwned}
            > ${this.getEmoji('delete')} **Blacklisted From:** ${blacklistedFromStr}
            > ${this.getEmoji('deleteDanger_icon')} **Banned:** ${userData?.banReason ? 'Yes' : 'No'}
             `,
        },
      ]);

    await interaction.reply({
      content: user.id,
      embeds: [embed],
      ephemeral: hideResponse,
    });
  }
}
