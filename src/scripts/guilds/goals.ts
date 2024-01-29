import { APIEmbed, Guild, resolveColor } from 'discord.js';
import { colors, mascotEmojis } from '../../utils/Constants.js';
import { getOrdinalSuffix } from '../../utils/Utils.js';

/**
 * @param channelId must be a channel ID in the support server
 */
export function logGuildJoin(guild: Guild, channelId: string) {
  guild.client.cluster.broadcastEval(
    async (client, ctx) => {
      const goalChannel = client.channels.cache.get(ctx.goalChannel);

      if (goalChannel?.isTextBased()) {
        const count = (await client.cluster.fetchClientValues('guilds.cache.size')) as number[];
        const guildCount = count.reduce((p, n) => p + n, 0);
        const ordinalSuffix = getOrdinalSuffix(guildCount);

        const goalEmbed: APIEmbed = {
          color: ctx.color,
          author: {
            name: `${ctx.guild.name} • ${ctx.guild.memberCount} members • ${ctx.guild.id}`,
            icon_url: ctx.guild.iconURL,
          },
        };

        // send message to support server notifying of new guild
        await goalChannel.send({
          content: `${ctx.flushedEmoji} I've just joined ${ctx.guild.name}, making it my **${guildCount}${ordinalSuffix}** guild! 🎉`,
          embeds: [goalEmbed],
        });
      }
    },
    {
      context: {
        guild: {
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
          iconURL: guild.iconURL() || undefined,
        },
        color: resolveColor(colors.interchatBlue),
        goalChannel: channelId,
        flushedEmoji: mascotEmojis.flushed,
      },
    },
  );
}

export async function logGuildLeave(guild: Guild, channelId: string) {
  const count = (await guild.client.cluster.fetchClientValues('guilds.cache.size')) as number[];
  // fetching owner manually because bot is no longer in the guild
  const guildOwner = await guild.client.users.fetch(guild.ownerId);

  // send message to support server notifying of leave
  // we cant access any variables/functions or anything inside the broadcastEval callback so we pass it in as context
  guild.client.cluster.broadcastEval(
    async (client, ctx) => {
      const goalChannel = await client.channels.fetch(ctx.goalChannel).catch(() => null);

      if (goalChannel?.isTextBased()) {
        const goalEmbed: APIEmbed = {
          color: ctx.color,
          author: {
            name: `${ctx.guild.name} • Owner @${ctx.guild.ownerName} • ${ctx.guild.memberCount} • ${ctx.guild.id}`,
            icon_url: ctx.guild.iconURL,
          },
        };

        await goalChannel.send({
          content: `👢 ${ctx.guild.name} kicked me. I'm back to **${ctx.guildCount}** servers ${ctx.cryEmoji}`,
          embeds: [goalEmbed],
        });
      }
    },
    {
      context: {
        guildCount: count.reduce((p, n) => p + n, 0),
        guild: {
          id: guild.id,
          name: guild.name,
          iconURL: guild.iconURL() || undefined,
          ownerName: guildOwner?.username,
          memberCount: guild.memberCount,
        },
        color: resolveColor('Red'),
        goalChannel: channelId,
        cryEmoji: mascotEmojis.cry,
      },
    },
  );
}
