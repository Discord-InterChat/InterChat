import { Redis } from 'ioredis';

// when run usin scripts like registerCmds
let redisClient: Redis;

export const getRedis = () => {
  if (!redisClient) redisClient = new Redis(process.env.REDIS_URI as string);
  return redisClient;
};

export default getRedis;
