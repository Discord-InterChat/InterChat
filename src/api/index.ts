import { VoteManager } from '../managers/VoteManager.js';
import Logger from '../utils/Logger.js';
import express from 'express';
import dblRoute from './routes/dbl.js';
import nsfwRouter from './routes/nsfw.js';

// to start the server
export const startApi = (data: { voteManager: VoteManager }) => {
  const app = express();

  app.use(express.static('src/api/public'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(nsfwRouter);
  if (data.voteManager) app.use(dblRoute(data.voteManager));

  app.listen(443, () => Logger.info('API listening on port http://localhost:443.'));
};
