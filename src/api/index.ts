import { Hono } from 'hono';
import { VoteManager } from '#src/managers/VoteManager.js';
import Constants from '#src/utils/Constants.js';
import Logger from '#utils/Logger.js';
import { serve } from '@hono/node-server';

export const startApi = () => {
  const app = new Hono({});
  const voteManager = new VoteManager();

  app.get('/', (c) => c.redirect(Constants.Links.Website));

  app.post('/dbl', async (c) => {
    await voteManager.middleware(c);
    return c.text('Vote received');
  });

  app.all('*', (c) => c.text('404!', 404));
  serve({ fetch: app.fetch, port: Number(process.env.PORT || 3000) });
  Logger.info(`API server started on port ${process.env.PORT || 3000}`);
};
