import { VoteManager } from '#main/managers/VoteManager.js';
import { Router } from 'express';

const dblRouter: Router = Router();
const voteManager = new VoteManager();

dblRouter.post('/', voteManager.middleware.bind(voteManager));

export default dblRouter;
