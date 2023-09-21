import { WebhookClient, WebhookMessageCreateOptions } from 'discord.js';
import { getDb } from '../misc/utils';

export default async function sendInNetwork(message: string | WebhookMessageCreateOptions, hubId: string) {
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
