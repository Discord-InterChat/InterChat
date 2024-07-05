import { Api } from '@top-gg/sdk';
import Logger from '../utils/Logger.js';
import 'dotenv/config';

export const topgg = new Api(process.env.TOPGG_API_KEY as string);

export default async ({ serverCount, shardCount }: { serverCount: number; shardCount: number }) => {
  await topgg
    .postStats({ serverCount, shardCount })
    .then((data) => {
      Logger.info(
        `Updated top.gg stats with ${data.serverCount} guilds and ${data.shardCount} shards`,
      );
    })
    .catch((e) => {
      Logger.error('Error updating top.gg stats', e);
    });
};
