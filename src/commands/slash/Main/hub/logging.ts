import { ChatInputCommandInteraction, CacheType, EmbedBuilder, ChannelType } from 'discord.js';
import db from '../../../../utils/Db.js';
import Hub from './index.js';
import { colors, emojis } from '../../../../utils/Constants.js';
import { errorEmbed } from '../../../../utils/Utils.js';
import { Prisma } from '@prisma/client';

export default class Logging extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const hub = interaction.options.getString('hub', true);
    const type = interaction.options.getString(
      'log_type',
      true,
    ) as keyof Prisma.HubLogChannelsCreateInput;
    const channel = interaction.options.getChannel('channel', true, [
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
    ]);

    const hubInDb = await db.hubs.findFirst({ where: { name: hub } });

    if (!hubInDb) {
      return await interaction.reply({
        embeds: [errorEmbed(`${emojis.no} This hub does not exist.`)],
      });
    }
    if (
      hubInDb?.ownerId !== interaction.user.id &&
      hubInDb?.moderators.some(
        (mod) => mod.userId === interaction.user.id && mod.position === 'manager',
      )
    ) {
      return await interaction.reply({
        embeds: [
          errorEmbed(`${emojis.no} You are not allowed to perform this action on this hub.`),
        ],
      });
    }

    await db.hubs.update({
      where: { id: hubInDb.id },
      data: {
        logChannels: {
          set: { [type]: channel.id },
        },
      },
    });

    const embed = new EmbedBuilder()
      .setTitle('Log Channel Set')
      .setDescription(
        `${emojis.yes} ${channel} will be used for sending \`${type}\` logs from now on.`,
      )
      .setColor(colors.invisible);

    await interaction.reply({ embeds: [embed] });
  }
}
