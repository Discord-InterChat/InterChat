import { APIEmbed, Guild, resolveColor } from 'discord.js';
import { channels, colors, mascotEmojis } from '../../utils/Constants.js';

/**
 * @param channelId must be a channel ID in the support server
 */
export const logGuildJoin = async (guild: Guild, channelId: string) => {
  await guild.client.cluster.broadcastEval(
    async (client, ctx) => {
      const { stripIndents } = require('common-tags');

      const goalChannel = client.channels.cache.get(ctx.goalChannel);
      const inviteLogChannel = client.channels.cache.get(ctx.inviteLogs);

      if (!goalChannel?.isTextBased() || !inviteLogChannel?.isTextBased()) return;

      const count = (await client.cluster.fetchClientValues('guilds.cache.size')) as number[];
      const guildCount = count.reduce((p, n) => p + n, 0);

      const logsEmbed: APIEmbed = {
        color: ctx.color,
        thumbnail: ctx.guild.iconURL ? { url: ctx.guild.iconURL } : undefined,
        title: '✨ Invited to New Server',
        description: stripIndents`
            - Name: ${ctx.guild.name}
            - ID: ${ctx.guild.id}
            - Owner: ${ctx.guild.owner.username} (${ctx.guild.owner.id})
            - Member Count: ${ctx.guild.memberCount}
          `,
      };

      const goalEmbed: APIEmbed = {
        color: ctx.color,
        author: {
          name: `${ctx.guild.name}`,
          icon_url: ctx.guild.iconURL,
        },
      };

      await inviteLogChannel.send({ embeds: [logsEmbed] });

      // send message to support server notifying of new guild
      await goalChannel.send({
        content: `${ctx.flushedEmoji} ${ctx.guild.name} added me, I'm now in **${guildCount}** servers! 🎉`,
        embeds: [goalEmbed],
      });
    },
    {
      context: {
        guild: {
          id: guild.id,
          name: guild.name,
          memberCount: guild.memberCount,
          iconURL: guild.iconURL() || undefined,
          owner: {
            username: (await guild.fetchOwner()).id,
            id: guild.ownerId,
          },
        },
        color: resolveColor(colors.interchatBlue),
        goalChannel: channelId,
        inviteLogs: channels.inviteLogs,
        flushedEmoji: mascotEmojis.flushed,
      },
    },
  );
};

export const logGuildLeave = async (guild: Guild, channelId: string) => {
  const count = (await guild.client.cluster.fetchClientValues('guilds.cache.size')) as number[];
  // fetching owner manually because bot is no longer in the guild
  const guildOwner = await guild.client.users.fetch(guild.ownerId);

  // send message to support server notifying of leave
  // we cant access any variables/functions or anything inside the broadcastEval callback so we pass it in as context
  await guild.client.cluster.broadcastEval(
    async (client, ctx) => {
      const { stripIndents } = require('common-tags');

      const goalChannel = await client.channels.fetch(ctx.goalChannel).catch(() => null);
      const inviteLogChannel = client.channels.cache.get(ctx.inviteLogs);

      if (!goalChannel?.isTextBased() || !inviteLogChannel?.isTextBased()) return;

      const logsEmbed: APIEmbed = {
        color: ctx.color,
        thumbnail: ctx.guild.iconURL ? { url: ctx.guild.iconURL } : undefined,
        title: '👢 Kicked from server',
        description: stripIndents`
            - Name: ${ctx.guild.name}
            - ID: ${ctx.guild.id}
            - Owner: ${ctx.guild.ownerName} (${ctx.guild.ownerId})
            - Member Count: ${ctx.guild.memberCount}
          `,
      };

      const goalEmbed: APIEmbed = {
        color: ctx.color,
        author: {
          name: `${ctx.guild.name}`,
          icon_url: ctx.guild.iconURL,
        },
      };

      await inviteLogChannel.send({ embeds: [logsEmbed] });
      await goalChannel.send({
        content: `👢 ${ctx.guild.name} kicked me. I'm back to **${ctx.guildCount}** servers ${ctx.cryEmoji}`,
        embeds: [goalEmbed],
      });
    },
    {
      context: {
        guildCount: count.reduce((p, n) => p + n, 0),
        guild: {
          id: guild.id,
          name: guild.name,
          iconURL: guild.iconURL() || undefined,
          ownerName: guildOwner?.username,
          ownerId: guild.ownerId,
          memberCount: guild.memberCount,
        },
        color: resolveColor('Red'),
        inviteLogs: channels.inviteLogs,
        goalChannel: channelId,
        cryEmoji: mascotEmojis.cry,
      },
    },
  );
};
