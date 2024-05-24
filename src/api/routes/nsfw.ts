import Logger from '../../utils/Logger.js';
import { Router } from 'express';
import { captureException } from '@sentry/node';
import { node } from '@tensorflow/tfjs-node';
import { REGEX, isDevBuild } from '../../utils/Constants.js';
import { createRequire } from 'module';
import { NSFWJS } from 'nsfwjs';

const require = createRequire(import.meta.url);
const { load } = require('nsfwjs');

// InceptionV3 is more accurate but slower and takes up a shit ton of memory
const nsfwModel: NSFWJS = await load(isDevBuild ? 'MobileNetV2' : 'InceptionV3');
const router = Router();

router.post('/nsfw', async (req, res) => {
  const imageUrl = req.body.imageUrl;

  if (!imageUrl || typeof imageUrl !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing imageUrl.' }));
    return;
  }

  if (!REGEX.STATIC_IMAGE_URL.test(imageUrl)) {
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
    const image = node.decodeImage(new Uint8Array(imageBuffer), 3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const predictions = await nsfwModel.classify(image as any);
    image.dispose();

    res.status(200).json(predictions);
  }
  catch (error) {
    Logger.error(error);
    captureException(error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
});

export default router;
