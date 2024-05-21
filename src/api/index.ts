import { VoteManager } from '../managers/VoteManager.js';
import Logger from '../utils/Logger.js';
import express from 'express';
import dblRoute from './routes/dbl.js';
import nsfwRouter from './routes/nsfw.js';
import { API_PORT } from '../utils/Constants.js';

// to start the server
export const startApi = (data: { voteManager: VoteManager }) => {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(nsfwRouter);
  if (data.voteManager) app.use(dblRoute(data.voteManager));

  app.listen(API_PORT, () => Logger.info(`API listening on port http://localhost:${API_PORT}.`));
};
