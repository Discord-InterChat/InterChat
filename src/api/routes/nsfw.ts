import { load } from 'nsfwjs';
import { Router } from 'express';
import { captureException } from '@sentry/node';
import { node } from '@tensorflow/tfjs-node';
import Logger from '../../utils/Logger.js';

const nsfwModel = await load();
const router: Router = Router();

router.get('/nsfw', async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const imageUrl = url.searchParams.get('url');

  if (!imageUrl || typeof imageUrl !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing url query parameter.' }));
    return;
  }

  const regex = /\bhttps?:\/\/\S+?\.(?:png|jpe?g)(?:\?\S+)?\b/;
  if (!regex.test(imageUrl)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Invalid url parameter. Must be a valid PNG, JPG, or JPEG image URL.',
      }),
    );
    return;
  }

  try {
    const imageBuffer = await (await fetch(imageUrl)).arrayBuffer();
    const imageTensor = (await node.decodeImage(Buffer.from(imageBuffer), 3)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const predictions = await nsfwModel.classify(imageTensor);
    imageTensor.dispose();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(predictions));
  }
  catch (error) {
    Logger.error(error);
    captureException(error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
});

export default router;