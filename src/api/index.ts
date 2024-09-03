import dblRouter from '#main/api/routes/dbl.js';
import nsfwRouter from '#main/api/routes/nsfw.js';
import { VoteManager } from '#main/modules/VoteManager.js';
import Logger from '#main/utils/Logger.js';
import express from 'express';

const app = express();

export const startApi = (voteManager: VoteManager) => {
  app.use(express.json());
  app.use(dblRouter(voteManager));
  app.use(nsfwRouter);

  app.get('/', (req, res) => res.redirect('https://interchat.fun'));

  // run da server
  app.listen(process.env.PORT, () =>
    Logger.info(`API listening on http://localhost:${process.env.PORT}`),
  );
};
