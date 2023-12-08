import http from 'http';
import { node } from '@tensorflow/tfjs-node';
import { load } from 'nsfwjs';
import Logger from '../utils/Logger.js';
import { captureException } from '@sentry/node';

const model = await load();
const port = 3000;

export default function start() {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url?.startsWith('/nsfw')) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imageTensor = (await node.decodeImage(Buffer.from(imageBuffer), 3)) as any;
        const predictions = await model.classify(imageTensor);
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
    }
    else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Why the hell are we even here? This is a 404.');
    }
  });

  server.listen(port, () => {
    Logger.info(`API listening on port http://localhost:${port}.`);
  });
}
