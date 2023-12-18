import { ChatInputCommandInteraction, CacheType, EmbedBuilder, ChannelType } from 'discord.js';
import db from '../../../../utils/Db.js';
import Hub from './index.js';
import { colors, emojis } from '../../../../utils/Constants.js';
import { simpleEmbed } from '../../../../utils/Utils.js';
import { Prisma } from '@prisma/client';
import { stripIndents } from 'common-tags';

export default class Logs extends Hub {
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const hub = interaction.options.getString('hub', true);
    const type = interaction.options.getString(
      'type',
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
        embeds: [simpleEmbed(`${emojis.no} This hub does not exist.`)],
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
          simpleEmbed(`${emojis.no} You are not allowed to perform this action on this hub.`),
        ],
      });
    }

    await db.hubs.update({
      where: { id: hubInDb.id },
      data: {
        logChannels: { upsert: { set: { [type]: channel.id }, update: { [type]: channel.id } } },
      },
    });

    const embed = new EmbedBuilder()
      .setDescription(
        stripIndents`
        ### <:beta:1170691588607983699> Log Channel Set

        ${emojis.yes} ${channel} will be used for sending \`${type}\` logs from now on.
        `,
      )
      .setColor(colors.invisible);

    await interaction.reply({ embeds: [embed] });
  }
}
