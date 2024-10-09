import dblRouter from '#main/api/routes/dbl.js';
import { VoteManager } from '#main/managers/VoteManager.js';
import Logger from '#utils/Logger.js';
import express from 'express';

const app = express();

export const startApi = (voteManager: VoteManager) => {
  app.use(express.json());
  app.use(dblRouter(voteManager));

  app.get('/', (req, res) => res.redirect('https://interchat.fun'));

  // run da server
  app.listen(process.env.PORT, () =>
    Logger.info(`API listening on http://localhost:${process.env.PORT}`),
  );
};
