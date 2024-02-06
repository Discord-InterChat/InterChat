import { load } from 'nsfwjs';
import { Router } from 'express';
import { captureException } from '@sentry/node';
import { enableProdMode, tensor3d } from '@tensorflow/tfjs-node';
import { Tensor3D } from '@tensorflow/tfjs';
import Logger from '../../utils/Logger.js';
import sharp from 'sharp';
import jpeg from 'jpeg-js';

// disable tfjs logs
enableProdMode();

let nsfwModel;
const router: Router = Router();

const imageToTensor = async (rawImageData: ArrayBuffer) => {
  rawImageData = await sharp(rawImageData).raw().jpeg().toBuffer();
  const decoded = jpeg.decode(rawImageData); // This is key for the prediction to work well
  const { width, height, data } = decoded;
  const buffer = new Uint8Array(width * height * 3);
  let offset = 0;
  for (let i = 0; i < buffer.length; i += 3) {
    buffer[i] = data[offset];
    buffer[i + 1] = data[offset + 1];
    buffer[i + 2] = data[offset + 2];

    offset += 4;
  }

  return tensor3d(buffer, [height, width, 3]) as unknown as Tensor3D;
};


router.get('/nsfw', async (req, res) => {
  nsfwModel = await load('http://localhost:443/model/');

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
    const imageTensor = await imageToTensor(imageBuffer);
    const predictions = await nsfwModel.classify(imageTensor);

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
