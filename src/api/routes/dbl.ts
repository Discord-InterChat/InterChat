import { Webhook } from '@top-gg/sdk';
import { Router } from 'express';
import { VoteManager } from '../../managers/VoteManager.js';

// NOTE: testing this against top.gg only works in the production server
// to test locally use postman or something similar to send a POST request to http://localhost:443/dbl
const router: Router = Router();
const TopggWebhook = new Webhook(process.env.TOPGG_AUTH);

export default (voteManager: VoteManager) => {
  router.post(
    '/dbl',
    TopggWebhook.listener((vote) => {
      // emit the vote event to use in other files
      voteManager?.emit('vote', vote);
    }),
  );
  return router;
};
