import { connectedList } from '@prisma/client';
import { GuildTextBasedChannel } from 'discord.js';
import { getDb } from '../Utils/functions/utils';

interface NetworkOptions {
  serverId?: string;
  channelId?: string;
}

const { connectedList } = getDb();

/** Returns found document from connectedList collection. */
export async function getServerData(filter: NetworkOptions) {
  const foundServerData = await connectedList.findFirst({ where: filter });
  return foundServerData;
}

/** Insert a guild & channel into connectedList collection.*/
export async function connect(channel: GuildTextBasedChannel) {
  const channelExists = await connectedList.findFirst({
    where: {
      channelId: channel.id,
    },
  });

  if (channelExists) return channelExists;

  return await connectedList.create({
    data: {
      channelId: channel.id,
      serverId: channel.guildId,
    },
  });
}

/** Returns a promise with the total number of connected servers.*/
export async function totalConnected() {
  return await connectedList.count();
}

// Disconnect a channel or server from the network.
export async function disconnect(options: NetworkOptions) {
  return await connectedList.deleteMany({ where: options });
}

export async function updateData(filter: NetworkOptions, data: NetworkOptions): Promise<connectedList>
export async function updateData(channelId: string, data: NetworkOptions): Promise<connectedList>
export async function updateData(where: NetworkOptions | string, data: NetworkOptions) {
  if (typeof where === 'string') return await connectedList.update({ where: { channelId: where }, data });
  return await connectedList.updateMany({ where, data });
}

export async function getAllNetworks() {
  return await connectedList.findMany();
}

export default { connect, disconnect, updateData, getServerData, totalConnected, getAllNetworks };
