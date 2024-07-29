import db from './Db.js';
import { connectedList, Prisma } from '@prisma/client';
import { getAllDocuments, getCachedData, serializeCache } from './db/cacheUtils.js';

export const fetchConnection = async (where: Prisma.connectedListWhereUniqueInput) =>
  await db.connectedList.findFirst({ where });

export const getConnection = async (channelId: string) => await getCachedData(
  `connectedList:${channelId}`,
  async () => await fetchConnection({ channelId }),
);

/**
 * @param where Specify filter to force fetch from the db
 */
export const getAllConnections = async (where?: Prisma.connectedListWhereInput) => {
  if (where) return await db.connectedList.findMany({ where });
  return serializeCache<connectedList>(await getAllDocuments('connectedList:*'));
};

export const deleteConnection = async (where: Prisma.connectedListWhereUniqueInput) => {
  await db.connectedList.delete({ where });
};

export const deleteConnections = async (where: Prisma.connectedListWhereInput) => {
  const items = await db.connectedList.findMany({ where });
  if (items.length === 0) return null;
  else if (items.length === 1) return await deleteConnection({ id: items[0].id });

  await db.connectedList.deleteMany({ where: { id: { in: items.map((i) => i.id) } } });
  await getAllConnections({ connected: true });
};

export const connectChannel = async (data: Prisma.connectedListCreateInput) =>
  await db.connectedList.create({ data });

export const modifyConnection = async (
  where: Prisma.connectedListWhereUniqueInput,
  data: Prisma.connectedListUpdateInput,
) => await db.connectedList.update({ where, data }).catch(() => null);

export const modifyConnections = async (
  where: Prisma.connectedListWhereInput,
  data: Prisma.connectedListUpdateInput,
) => await db.connectedList.updateMany({ where, data });
