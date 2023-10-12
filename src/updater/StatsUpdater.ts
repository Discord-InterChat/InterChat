import { URLs } from '../utils/Constants.js';
export const updateTopGGStats = async (totalGuilds: number, totalShards = 1) => {
  if (!process.env.TOPGG_API_KEY) throw new TypeError('Missing TOPGG_TOKEN environment variable');

  await fetch(`${URLs.TOPGG_API}/stats`, {
    method: 'POST',
    headers: {
      Authorization: process.env.TOPGG_API_KEY,
    },
    body: JSON.stringify({
      server_count: totalGuilds,
      shard_count: totalShards,
    }),
  });
};
