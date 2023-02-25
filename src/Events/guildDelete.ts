import { colors, constants, getDb } from '../Utils/functions/utils';
import { EmbedBuilder, Guild, TextChannel } from 'discord.js';
import { stripIndents } from 'common-tags';
import { disconnect } from '../Structures/network';
import { captureException } from '@sentry/node';


export default {
  name: 'guildDelete',
  async execute(guild: Guild) {
    if (!guild.available) return;
    const database = getDb();
    await database.setup.deleteMany({ where: { guildId: guild.id } });
    disconnect({ serverId: guild.id });

    const goalChannel = guild.client.channels.cache.get(constants.channel.goal) as TextChannel | undefined;

    goalChannel?.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('I have been kicked from a server 😢')
          .setDescription(stripIndents`
            **${1000 - guild.client.guilds.cache.size}** servers more to go! 💪

            **Server Name:** ${guild.name} (${guild.id})
            **Member Count:** ${guild.memberCount}
          `)
          .setThumbnail(guild.iconURL())
          .setTimestamp()
          .setColor(colors()),
      ],
    }).catch((e) => captureException(e));
  },
};
