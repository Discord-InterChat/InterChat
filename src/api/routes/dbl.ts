import { Webhook } from '@top-gg/sdk';
import { Router } from 'express';
import { VoteManager } from '#main/modules/VoteManager.js';
import 'dotenv/config';

// NOTE: testing this against top.gg only works in the production server
// to test locally use postman or something similar to send a POST request to http://localhost:443/dbl
const TopggWebhook = new Webhook(process.env.TOPGG_AUTH);
const router = Router();

const dblRoute = (voteManager: VoteManager): Router => {
  router.post(
    '/dbl',
    TopggWebhook.listener((payload) => {
      voteManager.emit('vote', payload);
    }),
  );
  return router;
};

export default dblRoute;
