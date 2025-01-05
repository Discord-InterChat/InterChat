import type { ClusterClient } from 'discord-hybrid-sharding';
import type {
  APIActionRowComponent,
  APIMessageActionRowComponent,
  Channel,
  Client,
  EmbedBuilder,
} from 'discord.js';

/**
 * Sends a log message to the specified channel with the provided embed.
 * @param channelId The ID of the channel to send the log message to.
 * @param embed The embed object containing the log message.
 */
export const sendLog = async (
  cluster: ClusterClient<Client>,
  channelId: string,
  embed: EmbedBuilder,
  opts?: {
    content?: string;
    components: APIActionRowComponent<APIMessageActionRowComponent>[];
  },
) => {
  await cluster.broadcastEval(
    async (shardClient, ctx) => {
      const channel = (await shardClient.channels
        .fetch(ctx.channelId)
        .catch(() => null)) as Channel | null;

      if (channel?.isSendable()) {
        await channel
          .send({
            content: ctx.content,
            embeds: [ctx.embed],
            components: ctx.components,
            allowedMentions: { parse: ['roles'] },
          })
          .catch(() => null);
      }
    },
    {
      context: {
        channelId,
        embed,
        content: opts?.content,
        components: opts?.components,
      },
    },
  );
};
