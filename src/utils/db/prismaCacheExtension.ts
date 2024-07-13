import db from '../Db.js';
import { Prisma } from '@prisma/client';
import { cacheData, getCacheKey, invalidateCacheForModel } from './cacheUtils.js';
import { DynamicQueryExtensionCb, InternalArgs, DefaultArgs } from '@prisma/client/runtime/library';

type ActionT =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findMany'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'aggregate'
  | 'count'
  | 'groupBy';

const middleware: DynamicQueryExtensionCb<
  Prisma.TypeMap<InternalArgs & DefaultArgs>,
  'model',
  Prisma.ModelName,
  ActionT
> = async ({ model, operation, args, query }) => {
  const isReadWriteOperation = [
    'create',
    'createMany',
    'update',
    'upsert',
    'findUnique',
    'findMany',
    'findFirst',
  ].includes(operation);

  // Execute the query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await query(args);
  if (!result) return result;

  if (isReadWriteOperation) {
    // Cache the result in Redis for 1 hour
    if (Array.isArray(result)) {
      if (result.length > 0) {
        result.forEach((r) => cacheData(r.id, JSON.stringify(r), model));
      }
    }
    else {
      cacheData(result.id, JSON.stringify(result), model);
    }
  }
  else if (operation === 'delete') {
    await db.cache.del(getCacheKey(model, result.id));
  }
  // Invalidate everything related to that model
  else if (operation === 'deleteMany') {
    invalidateCacheForModel(model);
  }
  else if (operation === 'updateMany') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // FIXME: remove lol
    (db[model] as any).findMany({ where: args.where }).then(console.log);
  }

  // always return the result regardless of which operation it was
  return result;
};

export default middleware;
