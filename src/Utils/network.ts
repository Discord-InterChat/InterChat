import { connectedList } from '@prisma/client';
import { getDb } from './utils';
import { WebhookClient, WebhookMessageCreateOptions } from 'discord.js';

const { connectedList } = getDb();

/** Reconnect a channel from the main network.*/
export async function reconnect(channelId: string) {
  const channelExists = await connectedList.findFirst({
    where: { channelId },
  });

  if (channelExists?.connected === false) {
    return await connectedList.update({
      where: { channelId: channelExists.channelId },
      data: { connected: true },
    });
  }
  return channelExists;
}

/** Disconnect a channel from the main network.*/
export async function disconnect(channelId: string) {
  const channelExists = await connectedList.findFirst({ where: { channelId } });
  if (channelExists?.connected) {
    return await connectedList.update({
      where: { channelId: channelExists.channelId },
      data: { connected: false },
    });
  }
  return channelExists;
}

export async function sendInNetwork(message: string | WebhookMessageCreateOptions, hubId: string) {
  if (typeof message !== 'string' && !message.username && !message.avatarURL) {
    message.username = 'InterChat Network';
    message.avatarURL = 'https://i.imgur.com/jHHkSrf.png';
  }

  const channels = await getDb().connectedList.findMany({ where: { hubId, connected: true } });

  channels?.forEach(async (channelEntry) => {
    const webhookClient = new WebhookClient({ url: channelEntry.webhookURL });
    await webhookClient.send(message);
  });
}

export default { reconnect, disconnect, sendInNetwork };
