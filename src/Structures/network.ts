import { connectedList } from '@prisma/client';
import { getDb } from '../Utils/functions/utils';

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

export default { reconnect, disconnect };
