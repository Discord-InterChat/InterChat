import Constants, { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Find from './index.js';

export default class Server extends Find {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hideResponse = interaction.options.getBoolean('hidden') ?? true;
    const userId = interaction.options.getString('user', true);
    const user = await interaction.client.users.fetch(userId).catch(() => null);
    if (!user) {
      const embed = new InfoEmbed().setDescription(
        `${emojis.no} Unknown user. Try using user\`s ID instead if you used username.`,
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const userData = await interaction.client.userManager.getUser(user.id);
    const blacklistList = await db.userInfraction.findMany({
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
    const hubsOwned = await db.hub.findMany({
      where: { ownerId: user.id },
    });
    const numServersOwned = serversOwned.length > 0 ? serversOwned.join(', ') : 'None';
    const numHubOwned = hubsOwned.length > 0 ? hubsOwned.map((hub) => hub.name).join(', ') : 'None';

    const embed = new EmbedBuilder()
      .setAuthor({ name: user.username, iconURL: user.avatarURL()?.toString() })
      .setColor(Constants.Colors.invisible)
      .setImage(user.bannerURL({ size: 1024 }) || null)
      .setThumbnail(user.avatarURL())
      .addFields([
        {
          name: 'User',
          value: stripIndents`
            > ${emojis.id} **ID:** ${user.id}
            > ${emojis.mention} **Username:** ${user.username}
            > ${emojis.members} **Created:** <t:${Math.round(user.createdTimestamp / 1000)}:R>
            > ${emojis.bot} **Bot:** ${user.bot}
            > ${emojis.owner} **Servers Owned:** ${numServersOwned}
            `,
        },
        {
          name: 'Network',
          value: stripIndents`
            > ${emojis.chat_icon} **Hubs Owned:** ${numHubOwned}
            > ${emojis.delete} **Blacklisted From:** ${blacklistedFromStr}
            > ${emojis.deleteDanger_icon} **Banned:** ${userData?.banMeta?.reason ? 'Yes' : 'No'}
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
