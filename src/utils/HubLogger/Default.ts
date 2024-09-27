import type { Prisma } from '@prisma/client';
import type { ClusterClient } from 'discord-hybrid-sharding';
import type { Channel, Client, EmbedBuilder } from 'discord.js';
import db from '../Db.js';
import { setReportLogChannel } from './Report.js';

export const setLogChannelFor = async (
  hubId: string,
  type: keyof Prisma.HubLogChannelsCreateInput,
  channelId: string,
) => {
  if (type === 'reports') {
    await setReportLogChannel(hubId, channelId);
  }
  else {
    await db.hubs.update({
      where: { id: hubId },
      data: {
        logChannels: {
          upsert: {
            set: { [type]: channelId },
            update: { [type]: channelId },
          },
        },
      },
    });
  }
};

/**
 * Sends a log message to the specified channel with the provided embed.
 * @param channelId The ID of the channel to send the log message to.
 * @param embed The embed object containing the log message.
 */
export const sendLog = async (
  cluster: ClusterClient<Client>,
  channelId: string,
  embed: EmbedBuilder,
  content?: string,
) => {
  await cluster.broadcastEval(
    async (shardClient, ctx) => {
      const channel = (await shardClient.channels
        .fetch(ctx.channelId)
        .catch(() => null)) as Channel | null;

      if (channel?.isSendable()) {
        await channel.send({ content: ctx.content, embeds: [ctx.embed] }).catch(() => null);
      }
    },
    { context: { channelId, embed, content } },
  );
};
