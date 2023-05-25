import { colors, constants, getDb } from '../Utils/functions/utils';
import { EmbedBuilder, Guild, TextChannel } from 'discord.js';
import { captureException } from '@sentry/node';
import { stripIndents } from 'common-tags';

export default {
  name: 'guildDelete',
  async execute(guild: Guild) {
    if (!guild.available) return;
    const db = getDb();
    await db.connectedList.deleteMany({ where: { serverId: guild.id } });

    const goalChannel = guild.client.channels.cache.get(constants.channel.goal) as TextChannel | undefined;

    goalChannel?.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('I have been kicked from a server 😢')
          .setDescription(stripIndents`
            I am now in **${guild.client.guilds.cache.size}** servers again! 💪

            **Server Name:** ${guild.name} (${guild.id})
            **Member Count:** ${guild.memberCount}
          `)
          .setThumbnail(guild.iconURL())
          .setTimestamp()
          .setColor(colors()),
      ],
    }).catch(captureException);
  },
};
