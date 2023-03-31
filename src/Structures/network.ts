import { connectedList, Prisma } from '@prisma/client';
import { getDb } from '../Utils/functions/utils';

interface NetworkOptions {
  serverId?: string;
  channelId?: string;
}

const { connectedList } = getDb();

/** Returns found document from connectedList collection. */
export async function getConnection(filter: NetworkOptions) {
  return await connectedList.findFirst({ where: filter });
}

export async function createConnection(data: Prisma.connectedListCreateInput) {
  return await connectedList.create({ data });
}

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

/** Returns a promise with the total number of connected servers.*/
export async function totalConnected() {
  return await connectedList.count();
}

// Disconnect a channel or server from the network.
export async function deleteConnection(options: NetworkOptions) {
  return await connectedList.deleteMany({ where: options });
}

export async function updateConnection(where: Prisma.connectedListWhereInput, data: Prisma.connectedListUpdateInput): Promise<connectedList>
export async function updateConnection(channelId: string, data: Prisma.connectedListUpdateInput): Promise<connectedList>
export async function updateConnection(where: Prisma.connectedListWhereInput | string, data: Prisma.connectedListUpdateInput) {
  if (typeof where === 'string') return await connectedList.update({ where: { channelId: where }, data });
  return await connectedList.updateMany({ where, data });
}

export async function getAllConnections(fillter?: Prisma.connectedListWhereInput) {
  return await connectedList.findMany(fillter ? { where: fillter } : undefined);
}

export default { reconnect, disconnect, updateConnection, getServerData: getConnection, totalConnected, getAllConnections };
