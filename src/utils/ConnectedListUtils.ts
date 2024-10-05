import { RedisKeys } from '#main/config/Constants.js';
import Logger from '#main/utils/Logger.js';
import cacheClient from '#main/utils/cache/cacheClient.js';
import type { connectedList, Prisma } from '@prisma/client';
import db from '#main/utils/Db.js';
import { cacheData, getCachedData } from '#main/utils/cache/cacheUtils.js';

type whereUniuqeInput = Prisma.connectedListWhereUniqueInput;
type whereInput = Prisma.connectedListWhereInput;
type dataInput = Prisma.connectedListUpdateInput;
type ConnectionOperation = 'create' | 'modify' | 'delete';

const purgeConnectionCache = async (channelId: string) =>
  await cacheClient.del(`${RedisKeys.connectionHubId}:${channelId}`);

const serializeConnection = (connection: ConvertDatesToString<connectedList>) => ({
  ...connection,
  date: new Date(connection.date),
  lastActive: connection.lastActive ? new Date(connection.lastActive) : null,
});

/**
 * @param where Specify filter to force fetch from the db
 */
export const getHubConnections = async (hubId: string) => {
  const connections =
    (await getCachedData(
      `${RedisKeys.hubConnections}:${hubId}`,
      async () => await db.connectedList.findMany({ where: { hubId } }),
      5 * 60, // 5 mins
    )) ?? [];

  return connections.data?.map(serializeConnection) || null;
};

export const syncHubConnCache = async (
  connection: connectedList,
  operation: ConnectionOperation,
) => {
  const start = performance.now();
  const hubConnections = await getHubConnections(connection.hubId);

  const totalConnections = hubConnections?.length ?? 0;
  Logger.debug(
    `[HubConnectionSync]: Started syncing ${totalConnections} hub connections with operation: ${operation}...`,
  );

  if (hubConnections && hubConnections?.length > 0) {
    let updatedConnections = hubConnections;
    switch (operation) {
      case 'create':
        updatedConnections = updatedConnections.concat(connection);
        break;
      case 'modify': {
        const index = updatedConnections.findIndex((c) => c.id === connection.id);

        if (index !== -1) updatedConnections[index] = connection;
        else updatedConnections = updatedConnections.concat(connection);

        break;
      }
      case 'delete':
        updatedConnections = updatedConnections.filter((conn) => conn.id !== connection.id);
        break;
      default:
        return;
    }

    await cacheData(
      `${RedisKeys.hubConnections}:${connection.hubId}`,
      JSON.stringify(updatedConnections),
    );
  }

  Logger.debug(
    `[HubConnectionSync]: Finished syncing ${totalConnections} hub connections with operation ${operation} in ${performance.now() - start}ms`,
  );
};

const cacheConnectionHubId = async (connection: connectedList) => {
  if (!connection.connected) {
    await cacheClient.del(`${RedisKeys.connectionHubId}:${connection.channelId}`);
  }
  else {
    await cacheData(`${RedisKeys.connectionHubId}:${connection.channelId}`, JSON.stringify({ id: connection.hubId }));
  }

  Logger.debug(
    `Cached connection hubId for ${connection.connected ? 'connected' : 'disconnected'} channel ${connection.channelId}.`,
  );
};

export const fetchConnection = async (channelId: string) => {
  const connection = await db.connectedList.findFirst({ where: { channelId } });
  if (!connection) return null;

  cacheConnectionHubId(connection);
  syncHubConnCache(connection, 'modify');

  return connection;
};

export const getConnectionHubId = async (channelId: string) => {
  const { data } = await getCachedData(
    `${RedisKeys.connectionHubId}:${channelId}`,
    async () => {
      const connection = await fetchConnection(channelId);
      return connection ? { id: connection.hubId } : null;
    },
  );

  return data?.id ?? null;
};

export const deleteConnection = async (where: whereUniuqeInput) => {
  const deleted = await db.connectedList.delete({ where });
  await purgeConnectionCache(deleted.channelId);
  return deleted;
};

export const createConnection = async (data: Prisma.connectedListCreateInput) => {
  const connection = await db.connectedList.create({ data });
  cacheConnectionHubId(connection);
  syncHubConnCache(connection, 'create');

  return connection;
};

export const deleteConnections = async (where: whereInput) => {
  const connections = await db.connectedList.findMany({ where });
  if (connections.length === 0) return [];
  else if (connections.length === 1) return await deleteConnection({ id: connections[0].id });

  const deletedCounts = await db.connectedList.deleteMany({
    where: { id: { in: connections.map((i) => i.id) } },
  });

  // TODO: Make a way to bulk update hubConnCache
  // repopulate cache
  connections.forEach(async (connection) => {
    await purgeConnectionCache(connection.channelId);
    await syncHubConnCache(connection, 'delete');
  });

  return deletedCounts;
};

export const updateConnection = async (where: whereUniuqeInput, data: dataInput) => {
  // Update in database
  const connection = await db.connectedList.update({ where, data });

  // Update cache
  await cacheConnectionHubId(connection);
  await syncHubConnCache(connection, 'modify');

  return connection;
};

export const updateConnections = async (where: whereInput, data: dataInput) => {
  // Update in database
  const updated = await db.connectedList.updateMany({ where, data });

  db.connectedList.findMany({ where }).then((connections) => {
    connections.forEach(async (connection) => {
      await cacheConnectionHubId(connection);
      await syncHubConnCache(connection, 'modify');
    });
  });

  return updated;
};
