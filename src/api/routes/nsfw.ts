import Logger from '#main/utils/Logger.js';
import { REGEX } from '#main/utils/Constants.js';
import { captureException } from '@sentry/node';
import { node } from '@tensorflow/tfjs-node';
import { Router } from 'express';
import { createRequire } from 'module';
import { NSFWJS } from 'nsfwjs';

const require = createRequire(import.meta.url);
const { load } = require('nsfwjs');

// InceptionV3 is more accurate but slower and takes up a shit ton of memory
const nsfwModel: NSFWJS = await load(process.env.NSFW_AI_MODEL);
const router: Router = Router();

router.post('/nsfw', async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl || typeof imageUrl !== 'string') {
    res.status(400).json({ error: 'Missing imageUrl in body.' });
    return;
  }

  if (!REGEX.STATIC_IMAGE_URL.test(imageUrl)) {
    res
      .status(400)
      .json({ error: 'Invalid url parameter. Must be a valid PNG, JPG, or JPEG image URL.' });
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
    res.status(500).json({ error: '500: Internal Server Error' });
  }
});

export default router;
