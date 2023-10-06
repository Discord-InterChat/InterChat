import { connectedList, hubs } from '@prisma/client';
import { getDb, getOrCreateWebhook } from './utils';
import { Guild, TextChannel, ThreadChannel, WebhookClient, WebhookMessageCreateOptions } from 'discord.js';
import { stripIndents } from 'common-tags';
import emojis from './JSON/emoji.json';

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

export async function sendInNetwork(message: WebhookMessageCreateOptions, hubId: string) {
  if (typeof message !== 'string' && !message.username && !message.avatarURL) {
    message.username = 'InterChat Network';
    message.avatarURL = 'https://i.imgur.com/jHHkSrf.png';
  }

  const channels = await getDb().connectedList.findMany({ where: { hubId, connected: true } });

  channels?.forEach(async (channelEntry) => {
    const webhookClient = new WebhookClient({ url: channelEntry.webhookURL });
    await webhookClient.send(channelEntry.parentId ? { ...message, threadId: channelEntry.channelId } : message);
  });
}

export async function createConnection(guild: Guild, hub: hubs, networkChannel: TextChannel | ThreadChannel) {
  const webhook = await getOrCreateWebhook(networkChannel, guild.client.user?.displayAvatarURL());
  if (!webhook) return;

  const emoji = emojis.normal;
  const createdConnection = await connectedList.create({
    data: {
      channelId: networkChannel.id,
      parentId: networkChannel.isThread() ? networkChannel.id : undefined,
      serverId: networkChannel.guild.id,
      webhookURL: webhook.url,
      connected: true,
      profFilter: true,
      compact: false,
      hub: { connect: { id: hub.id } },
    },
  });


  const numOfConnections = await connectedList.count({ where: { hubId: hub.id } });
  await networkChannel?.send(
    `This channel has been connected with **${hub.name}**. ${
      numOfConnections > 1
        ? `You are currently with ${numOfConnections - 1} other servers, Enjoy! ${emoji.clipart}`
        : `It seems no one else is there currently... *cricket noises* ${emoji.clipart}`
    }`,
  );

  sendInNetwork({
    content: stripIndents`
    A new server has joined us! ${emoji.clipart}

    **Server Name:** __${guild.name}__
    **Member Count:** __${guild.memberCount}__
  ` }, hub.id);

  // return the created connection so we can use it in the next step
  return createdConnection;
}

export default { reconnect, disconnect, sendInNetwork, createConnection, getOrCreateWebhook };
