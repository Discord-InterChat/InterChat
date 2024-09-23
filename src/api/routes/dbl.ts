// express route boyeee
import { VoteManager } from '#main/modules/VoteManager.js';
import type { WebhookPayload } from '#main/types/topgg.d.ts';
import Logger from '#main/utils/Logger.js';
import { Router } from 'express';

const isValidVotePayload = (payload: WebhookPayload) => {
  const payloadTypes = ['upvote', 'test'];
  const isValidData =
    typeof payload.user === 'string' &&
    typeof payload.bot === 'string' &&
    payloadTypes.includes(payload.type);

  const isValidWeekendType =
    typeof payload.isWeekend === 'boolean' || typeof payload.isWeekend === 'undefined';

  return isValidData && isValidWeekendType;
};

const router: Router = Router();

export default (voteManager: VoteManager) => {
  router.post('/dbl', (req, res) => {
    const dblHeader = req.header('Authorization');
    if (dblHeader !== process.env.TOPGG_WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const payload: WebhookPayload = req.body;

    if (!isValidVotePayload(payload)) {
      Logger.error('Invalid payload received from top.gg, possible untrusted request: %O', payload);
      return res.status(400).json({ message: 'Invalid payload' });
    }

    voteManager.emit('vote', payload);

    return res.status(204).send();
  });

  return router;
};
