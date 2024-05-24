import db from './Db.js';
import Logger from './Logger.js';
import { Prisma, connectedList } from '@prisma/client';
import { Collection } from 'discord.js';
import { captureException } from '@sentry/node';

/** 📡 Contains all the **connected** channels from all hubs. */
export const connectionCache = new Collection<string, connectedList>();
export const messageTimestamps = new Collection<string, Date>();

export const syncConnectionCache = async () => {
  Logger.debug('[InterChat]: Populating connection cache.');
  const connections = await db.connectedList.findMany({ where: { connected: true } });

  // populate all at once without time delay
  connections.forEach((c) => connectionCache.set(c.channelId, c));
  Logger.debug(`[InterChat]: Connection cache populated with ${connectionCache.size} entries.`);
};

export const deleteConnection = async (where: Prisma.connectedListWhereUniqueInput) => {
  const del = await db.connectedList.delete({ where });
  connectionCache.delete(del.channelId);
};

export const deleteConnections = async (where: Prisma.connectedListWhereInput) => {
  await db.connectedList.deleteMany({ where });

  syncConnectionCache()
    .then(() => null)
    .catch(() => null);
};

export const connectChannel = async (data: Prisma.connectedListCreateInput) => {
  const connection = await db.connectedList.create({ data });

  connectionCache.set(connection.channelId, connection);
  return connection;
};

export const modifyConnection = async (
  where: Prisma.connectedListWhereUniqueInput,
  data: Prisma.connectedListUpdateInput,
) => {
  const connection = await db.connectedList.update({ where, data });
  connectionCache.set(connection.channelId, connection);
  return connection;
};

export const modifyConnections = async (
  where: Prisma.connectedListWhereInput,
  data: Prisma.connectedListUpdateInput,
) => {
  const connections = await db.connectedList.updateMany({ where, data });

  syncConnectionCache()
    .then(() => null)
    .catch(() => null);

  return connections;
};

export const storeMsgTimestamps = (data: Collection<string, Date>): void => {
  data.forEach(
    async (lastActive, channelId) =>
      await modifyConnection({ channelId }, { lastActive }).catch(captureException),
  );
};
