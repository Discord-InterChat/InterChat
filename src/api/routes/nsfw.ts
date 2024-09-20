import Constants from '#main/config/Constants.js';
import Logger from '#main/utils/Logger.js';
import { captureException } from '@sentry/node';
import { node, Tensor3D } from '@tensorflow/tfjs-node';
import { Response, Router } from 'express';
import { createRequire } from 'module';
import { NSFWJS } from 'nsfwjs';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { load } = require('nsfwjs');

const nsfwModel: NSFWJS = await load(process.env.NSFW_AI_MODEL);
const router: Router = Router();

const invalidImageURLResponse = (res: Response) =>
  res.status(400).json({
    message: 'Invalid imageURL. Must be a valid PNG, JPG, JPEG or WebP image URL.',
  });

router.post('/nsfw', async (req, res) => {
  try {
    const imageURL = req.body.imageURL;

    if (!imageURL || typeof imageURL !== 'string') {
      return res.status(400).json({ message: 'Missing imageURL in body.' });
    }

    if (!Constants.Regex.StaticImageUrl.test(imageURL)) return invalidImageURLResponse(res);

    const imageReq = await fetch(imageURL);
    if (!imageReq.ok) return invalidImageURLResponse(res);

    const jpegImgBuffer = await sharp(await imageReq.arrayBuffer())
      .toFormat('jpeg')
      .toBuffer();

    const image = node.decodeImage(new Uint8Array(jpegImgBuffer), 3);
    const predictions = await nsfwModel.classify(image as Tensor3D);
    image.dispose();

    return res.status(200).json({ predictions });
  }
  catch (error) {
    Logger.error(error);
    captureException(error);
    return invalidImageURLResponse(res);
  }
});

export default router;
