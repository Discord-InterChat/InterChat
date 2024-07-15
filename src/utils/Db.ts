import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import prismaCacheExtension from './db/prismaCacheExtension.js';

// FIXME: Redis being instantiated like this causes it to never disconnect
// when run usin scripts like registerCmds
const cache = new Redis();
const db = new PrismaClient().$extends({
  name: '[Cache Middleware]',
  client: { cache },
  query: {
    $allModels: {
      $allOperations: prismaCacheExtension,
    },
  },
});

export default db;
