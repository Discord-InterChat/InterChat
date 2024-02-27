import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Find from './index.js';
import { stripIndents } from 'common-tags';
import { colors, emojis } from '../../../../utils/Constants.js';
import db from '../../../../utils/Db.js';
import { simpleEmbed } from '../../../../utils/Utils.js';

export default class Server extends Find {
  async execute(interaction: ChatInputCommandInteraction) {
    const hideResponse = interaction.options.getBoolean('hidden') ?? true;
    const userId = interaction.options.getString('user', true);
    const user = await interaction.client.users.fetch(userId).catch(() => null);
    if (!user) {
      return interaction.reply({
        embeds: [
          simpleEmbed(
            `${emojis.no} Unknown user. Try using user\`s ID instead if you used username.`,
          ),
        ],
        ephemeral: true,
      });
    }

    const userInBlacklist = await db.blacklistedUsers?.findFirst({ where: { userId: user.id } });

    const serversOwned = user.client.guilds.cache
      .filter((guild) => guild.ownerId == user.id)
      .map((guild) => guild.name);
    const hubsOwned = await db.hubs.findMany({
      where: { ownerId: user.id },
    });

    const embed = new EmbedBuilder()
      .setAuthor({ name: user.username, iconURL: user.avatarURL()?.toString() })
      .setColor(colors.invisible)
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
            > ${emojis.owner} **Servers Owned:** ${
              serversOwned.length > 0 ? serversOwned.join(', ') : 'None'
            }
            `,
        },
        {
          name: 'Network',
          value: stripIndents`
            > ${emojis.chat_icon} **Hubs Owned:** ${
              hubsOwned.length > 0 ? hubsOwned.map((hub) => hub.name).join(', ') : 'None'
            }
            > ${emojis.delete} **Blacklisted:** ${userInBlacklist ? 'Yes' : 'No'}`,
        },
      ]);

    await interaction.reply({
      content: user.id,
      embeds: [embed],
      ephemeral: hideResponse,
    });
  }
}
