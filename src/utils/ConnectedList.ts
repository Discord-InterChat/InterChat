import db from './Db.js';
import Logger from './Logger.js';
import { Prisma, connectedList } from '@prisma/client';
import { Collection } from 'discord.js';
import { captureException } from '@sentry/node';

/** 📡 Contains all the **connected** channels from all hubs. */
export const connectionCache = new Collection<string, connectedList>();
export const messageTimestamps = new Collection<string, Date>();

export const syncConnectionCache = async (
  where: Prisma.connectedListWhereInput = { connected: true },
) => {
  const start = performance.now();
  Logger.debug('[InterChat]: Started populating connection cache.');

  const connections = await db.connectedList.findMany({ where });

  if (connectionCache.size > 0) {
    connectionCache.forEach((c) => {
      if (!connections.some(({ channelId }) => channelId === c.channelId)) {
        connectionCache.delete(c.channelId);
      }
    });
  }

  // populate all at once without time delay
  connections.forEach((c) => connectionCache.set(c.channelId, c));

  const end = performance.now();
  Logger.debug(
    `[InterChat]: Connection cache populated with ${connectionCache.size} entries. Took ${end - start}ms.`,
  );
};

export const deleteConnection = async (where: Prisma.connectedListWhereUniqueInput) => {
  const del = await db.connectedList.delete({ where });
  connectionCache.delete(del.channelId);
};

export const deleteConnections = async (where: Prisma.connectedListWhereInput) => {
  await db.connectedList.deleteMany({ where });
  await syncConnectionCache().catch(captureException);
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
  const connection = await db.connectedList.update({ where, data }).catch(() => null);
  if (connection) connectionCache.set(connection.channelId, connection);

  return connection;
};

export const modifyConnections = async (
  where: Prisma.connectedListWhereInput,
  data: Prisma.connectedListUpdateInput,
) => {
  await db.connectedList.updateMany({ where, data });
  await syncConnectionCache(where).catch(captureException);
};

export const storeMsgTimestamps = (data: Collection<string, Date>): void => {
  data.forEach(
    async (lastActive, channelId) =>
      await modifyConnection({ channelId }, { lastActive }),
  );
};
