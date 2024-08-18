import { channels, colors, mascotEmojis } from '#main/utils/Constants.js';
import { APIEmbed, ColorResolvable, EmbedBuilder, Guild } from 'discord.js';

const buildGoalEmbed = (guildName: string, iconURL: string | null, color: ColorResolvable) =>
  new EmbedBuilder().setAuthor({ name: guildName, iconURL: iconURL ?? undefined }).setColor(color);

const getContext = async (guild: Guild, channelId: string) => ({
  guild: {
    id: guild.id,
    name: guild.name,
    memberCount: guild.memberCount,
    iconURL: guild.iconURL() || undefined,
    owner: {
      username: (await guild.client.users.fetch(guild.ownerId)).username,
      id: guild.ownerId,
    },
  },
  goalChannel: channelId,
  inviteLogs: channels.inviteLogs,
});

/**
 * @param channelId must be a channel ID in the support server
 */
export const logGuildJoin = async (guild: Guild, channelId: string) => {
  await guild.client.cluster.broadcastEval(
    async (client, ctx) => {
      // FIXME: check this import too
      const { stripIndents } = await import('common-tags');

      const goalChannel = client.channels.cache.get(ctx.goalChannel);
      const inviteLogChannel = client.channels.cache.get(ctx.inviteLogs);

      if (!goalChannel?.isTextBased() || !inviteLogChannel?.isTextBased()) return;

      const count = (await client.cluster.fetchClientValues('guilds.cache.size')) as number[];
      const guildCount = count.reduce((p, n) => p + n, 0);

      const logsEmbed: APIEmbed = {
        color: ctx.goalEmbed.color,
        thumbnail: ctx.guild.iconURL ? { url: ctx.guild.iconURL } : undefined,
        title: '✨ Invited to New Server',
        description: stripIndents`
            - Name: ${ctx.guild.name}
            - ID: ${ctx.guild.id}
            - Owner: ${ctx.guild.owner.username} (${ctx.guild.owner.id})
            - Member Count: ${ctx.guild.memberCount}
          `,
      };

      await inviteLogChannel.send({ embeds: [logsEmbed] });

      // send message to support server notifying of new guild
      await goalChannel.send({
        content: `${ctx.flushedEmoji} ${ctx.guild.name} added me, I'm now in **${guildCount}** servers! 🎉`,
        embeds: [ctx.goalEmbed],
      });
    },
    {
      context: {
        ...(await getContext(guild, channelId)),
        goalEmbed: buildGoalEmbed(guild.name, guild.iconURL(), colors.interchatBlue).toJSON(),
        flushedEmoji: mascotEmojis.flushed,
      },
    },
  );
};

export const logGuildLeave = async (guild: Guild, channelId: string) => {
  const count = (await guild.client.cluster.fetchClientValues('guilds.cache.size')) as number[];
  // send message to support server notifying of leave
  // we cant access any variables/functions or anything inside the broadcastEval callback so we pass it in as context
  await guild.client.cluster.broadcastEval(
    async (client, ctx) => {
      // FIXME: Check if this dynamic import even works
      const { stripIndents } = await import('common-tags');

      const goalChannel = await client.channels.fetch(ctx.goalChannel).catch(() => null);
      const inviteLogChannel = client.channels.cache.get(ctx.inviteLogs);

      if (!goalChannel?.isTextBased() || !inviteLogChannel?.isTextBased()) return;

      const logsEmbed: APIEmbed = {
        color: ctx.goalEmbed.color,
        thumbnail: ctx.guild.iconURL ? { url: ctx.guild.iconURL } : undefined,
        title: '👢 Kicked from server',
        description: stripIndents`
            - Name: ${ctx.guild.name}
            - ID: ${ctx.guild.id}
            - Owner: ${ctx.guild.owner.username} (${ctx.guild.owner.id})
            - Member Count: ${ctx.guild.memberCount}
          `,
      };

      await inviteLogChannel.send({ embeds: [logsEmbed] });
      await goalChannel.send({
        content: `👢 ${ctx.guild.name} kicked me. I'm back to **${ctx.guildCount}** servers ${ctx.cryEmoji}`,
        embeds: [ctx.goalEmbed],
      });
    },
    {
      context: {
        ...(await getContext(guild, channelId)),
        guildCount: count.reduce((p, n) => p + n, 0),
        goalEmbed: buildGoalEmbed(guild.name, guild.iconURL(), 'Red'),
        cryEmoji: mascotEmojis.cry,
      },
    },
  );
};
