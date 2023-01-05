import { colors, constants, getDb } from '../Utils/functions/utils';
import { EmbedBuilder, Guild, TextChannel } from 'discord.js';
import { NetworkManager } from '../Structures/network';
import { stripIndents } from 'common-tags';


export default {
  name: 'guildDelete',
  async execute(guild: Guild) {
    const database = getDb();
    await database.setup.deleteMany({ where: { guildId: guild.id } });
    new NetworkManager().disconnect({ serverId: guild.id });

    const goalChannel = guild.client.channels.cache.get(constants.channel.goal) as TextChannel;

    goalChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('I have been kicked from a server 😢')
          .setDescription(stripIndents`
	    **${800 - guild.client.guilds.cache.size}** servers more to go! 💪
					
	    **Server Name:** ${guild.name} (${guild.id})
	    **Member Count:** ${guild.memberCount}
          `)
          .setThumbnail(guild.iconURL())
          .setTimestamp()
          .setColor(colors()),
      ],
    });
  },
};
