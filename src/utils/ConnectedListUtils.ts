import Logger from '#main/utils/Logger.js';
import type { ConvertDatesToString } from '#types/Utils.d.ts';
import { cacheData, getCachedData } from '#utils/CacheUtils.js';
import { RedisKeys } from '#utils/Constants.js';
import db from '#utils/Db.js';
import getRedis from '#utils/Redis.js';
import type { connectedList, Prisma } from '@prisma/client';
import isEmpty from 'lodash/isEmpty.js';

type whereUniuqeInput = Prisma.connectedListWhereUniqueInput;
type whereInput = Prisma.connectedListWhereInput;
type dataInput = Prisma.connectedListUpdateInput;
type CachedConnection = ConvertDatesToString<connectedList>;

const convertToConnectedList = (connection: CachedConnection): connectedList => ({
  ...connection,
  date: new Date(connection.date),
  lastActive: new Date(connection.lastActive),
});

/**
 * This includes both connected and disconnected connections
 */
export const getHubConnections = async (hubId: string): Promise<connectedList[]> => {
  const redis = getRedis();
  const key = `${RedisKeys.hubConnections}:${hubId}`;
  const cached = await redis.hgetall(key);

  if (isEmpty(cached) === false) {
    const cachedData = Object.values(cached).map((c) => convertToConnectedList(JSON.parse(c)));
    return cachedData;
  }

  const fromDb = await db.connectedList.findMany({ where: { hubId } });
  const keyValuePairs = fromDb.flatMap((c) => [c.id, JSON.stringify(c)]);

  if (keyValuePairs.length === 0) return [];

  Logger.debug(`Caching ${fromDb.length} connections for hub ${hubId}`);

  await redis.hset(key, keyValuePairs);
  await redis.expire(key, 10 * 60 * 1000); // 10 minutes

  Logger.debug(`Cached ${fromDb.length} connections for hub ${hubId}`);

  return fromDb;
};

export const cacheHubConnection = async (connection: connectedList) => {
  const redis = getRedis();
  const cached = await redis.hlen(`${RedisKeys.hubConnections}:${connection.hubId}`);

  Logger.debug(`Caching connection ${connection.id} for hub ${connection.hubId}`);

  if (!cached) {
    Logger.debug(`No cached connections for hub ${connection.hubId}, fetching from database`);
    await getHubConnections(connection.hubId);
    Logger.debug(`Fetched connections for hub ${connection.hubId}`);
    return;
  }

  await getRedis().hset(
    `${RedisKeys.hubConnections}:${connection.hubId}`,
    connection.id,
    JSON.stringify(connection),
  );

  Logger.debug(`Cached connection ${connection.id} for hub ${connection.hubId}`);
};

export const removeFromHubConnections = async (connId: string, hubId: string) => {
  await getRedis().hdel(`${RedisKeys.hubConnections}:${hubId}`, connId);
};

const purgeConnectionCache = async (channelId: string) => {
  await getRedis().del(`${RedisKeys.connectionHubId}:${channelId}`);
};

const cacheConnectionHubId = async (...connections: connectedList[]) => {
  const keysToDelete: string[] = [];
  const cachePromises: Promise<void>[] = [];

  // Single pass through the data
  for (const { connected, channelId, hubId } of connections) {
    const key = `${RedisKeys.connectionHubId}:${channelId}`;

    if (!connected) {
      keysToDelete.push(key);
    }
    else {
      cachePromises.push(cacheData(key, JSON.stringify({ id: hubId })));
    }
  }

  // Execute operations in parallel
  const deletePromise = keysToDelete.length > 0 ? getRedis().del(keysToDelete) : undefined;
  const promises = deletePromise ? [...cachePromises, deletePromise] : cachePromises;
  await Promise.all(promises);
};

export const fetchConnection = async (channelId: string) => {
  const connection = await db.connectedList.findFirst({ where: { channelId } });
  if (!connection) return null;

  await cacheConnectionHubId(connection);
  await cacheHubConnection(connection);

  return connection;
};

export const getConnectionHubId = async (channelId: string) => {
  const { data } = await getCachedData(`${RedisKeys.connectionHubId}:${channelId}`, async () => {
    const connection = await fetchConnection(channelId);
    return connection ? { id: connection.hubId } : null;
  });

  return data?.id ?? null;
};

export const deleteConnection = async (where: whereUniuqeInput) => {
  const connection = await db.connectedList.findFirst({ where });
  if (!connection) return null;

  const deleted = await db.connectedList.delete({ where });
  await removeFromHubConnections(deleted.id, deleted.hubId);
  await purgeConnectionCache(deleted.channelId);
  return deleted;
};

export const createConnection = async (data: Prisma.connectedListCreateInput) => {
  const connection = await db.connectedList.create({ data });
  await cacheConnectionHubId(connection);
  await cacheHubConnection(connection);

  return connection;
};

export const deleteConnections = async (where: whereInput) => {
  const connections = await db.connectedList.findMany({ where });
  if (connections.length === 0) return [];
  else if (connections.length === 1) return [await deleteConnection({ id: connections[0].id })];

  await db.connectedList.deleteMany({
    where: { id: { in: connections.map((i) => i.id) } },
  });

  // repopulate cache
  connections.forEach(async (connection) => {
    await removeFromHubConnections(connection.id, connection.hubId);
    await purgeConnectionCache(connection.channelId);
  });

  return connections;
};

export const updateConnection = async (where: whereUniuqeInput, data: dataInput) => {
  const conn = await db.connectedList.findFirst({ where });
  if (!conn) return null;

  // Update in database
  const connection = await db.connectedList.update({ where, data });

  // Update cache
  await cacheConnectionHubId(connection);
  await cacheHubConnection(connection);

  return connection;
};

export const updateConnections = async (where: whereInput, data: dataInput) => {
  // Update in database
  const updated = await db.connectedList.updateMany({ where, data });

  db.connectedList.findMany({ where }).then(async (connections) => {
    await cacheConnectionHubId(...connections);
    connections.forEach(cacheHubConnection);
  });

  return updated;
};
