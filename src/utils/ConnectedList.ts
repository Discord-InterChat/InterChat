import { RedisKeys } from '#main/utils/Constants.js';
import Logger from '#main/utils/Logger.js';
import cacheClient from '#main/utils/cache/cacheClient.js';
import type { connectedList, Prisma } from '@prisma/client';
import db from './Db.js';
import { cacheData, getCachedData } from './cache/cacheUtils.js';

type whereUniuqeInput = Prisma.connectedListWhereUniqueInput;
type whereInput = Prisma.connectedListWhereInput;
type dataInput = Prisma.connectedListUpdateInput;
type ConnectionAction = 'create' | 'modify' | 'delete';

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

export const syncHubConnCache = async (connection: connectedList, action: ConnectionAction) => {
  const start = performance.now();
  const hubConnections = (
    (
      await getCachedData(
        `${RedisKeys.hubConnections}:${connection.hubId}`,
        async () => (await getHubConnections(connection.hubId)) || [],
      )
    ).data || []
  ).map(serializeConnection);

  Logger.debug(`[HubCon Sync]: Started syncing ${hubConnections.length} hub connections...`);

  let updatedConnections: connectedList[];
  switch (action) {
    case 'create':
      updatedConnections = [...hubConnections, connection];
      break;
    case 'modify':
      updatedConnections = hubConnections.map((conn) =>
        conn.id === connection.id ? connection : conn,
      );
      break;
    case 'delete':
      updatedConnections = hubConnections.filter((conn) => conn.id !== connection.id);
      break;
    default:
      return;
  }

  await cacheData(
    `${RedisKeys.hubConnections}:${connection.hubId}`,
    JSON.stringify(updatedConnections),
  );
  Logger.debug(
    `[HubCon Sync]: Finished syncing ${hubConnections.length} hub connections in ${performance.now() - start}ms`,
  );
};

const cacheConnectionStatus = async (connection: connectedList) => {
  await cacheData(
    `${RedisKeys.connectionHubId}:${connection.channelId}`,
    connection.connected ? 't' : 'f',
  );

  Logger.debug(
    `Cached connection status for ${connection.channelId}: ${connection.connected ? 'connected' : 'disconnected'}.`,
  );
};

export const getConnection = async (channelId: string) => {
  const connection = await db.connectedList.findFirst({ where: { channelId } });
  if (!connection) return null;
  cacheConnectionStatus(connection);

  return connection;
};

export const getConnectionHubId = async (channelId: string) => {
  const { data: hubId } = await getCachedData(
    `${RedisKeys.connectionHubId}:${channelId}`,
    async () => (await getConnection(channelId))?.hubId,
  );

  return hubId;
};

export const deleteConnection = async (where: whereUniuqeInput) => {
  const deleted = await db.connectedList.delete({ where });
  await purgeConnectionCache(deleted.channelId);
  return deleted;
};

export const createConnection = async (data: Prisma.connectedListCreateInput) => {
  const connection = await db.connectedList.create({ data });
  cacheConnectionStatus(connection);
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
  await cacheConnectionStatus(connection);
  await syncHubConnCache(connection, 'modify');

  return connection;
};

export const updateConnections = async (where: whereInput, data: dataInput) => {
  try {
    // Update in database
    const updated = await db.connectedList.updateMany({ where, data });
    return updated;
  }
  finally {
    // repopulate cache
    db.connectedList.findMany({ where }).then((connections) => {
      connections.forEach(async (connection) => {
        await cacheConnectionStatus(connection);
        await syncHubConnCache(connection, 'modify');
      });
    });
  }
};
