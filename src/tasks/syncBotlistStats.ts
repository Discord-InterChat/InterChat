import 'dotenv/config';
import Logger from '#main/utils/Logger.js';

const logPostError = (error: unknown) => {
  Logger.error('[TopGGPostStats]: Error updating stats %O', error);
};

const logPostSuccess = (data: TopggStats) => {
  Logger.info(
    `[TopGGPostStats]: Updated top.gg stats with ${data.serverCount} guilds and ${data.shardCount} shards`,
  );
};

type TopggStats = {
  serverCount: number;
  shardCount: number;
};

export default async ({ serverCount, shardCount }: TopggStats) => {
  if (process.env.CLIENT_ID !== '769921109209907241') {
    Logger.warn(
      '[TopGGPostStats]: CLIENT_ID environment variable does not match InterChat\'s actual ID.',
    );
    return;
  }

  await fetch('https://top.gg/api/v1/bots/769921109209907241/stats', {
    method: 'POST',
    body: JSON.stringify({ serverCount, shardCount }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.TOPGG_API_KEY as string,
    },
  })
    .then(async (res) => {
      const data = (await res.json()) as TopggStats;

      if (res.status !== 200) {
        logPostError(data);
        return;
      }

      logPostSuccess(data);
    })
    .catch(logPostError);
};
