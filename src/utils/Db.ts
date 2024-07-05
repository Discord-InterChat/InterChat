import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import prismaCacheExtension from './db/prismaCacheExtension.js';

const redis = new Redis();
const db = new PrismaClient().$extends({
  name: '[Cache Middleware]',
  client: { cache: redis },
  query: {
    $allModels: {
      $allOperations: prismaCacheExtension,
    },
  },
});

export default db;
