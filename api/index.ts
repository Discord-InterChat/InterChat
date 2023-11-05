import express from 'express';
import { node } from '@tensorflow/tfjs-node';
import { load, predictionType } from 'nsfwjs';

const model = await load();
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const analyzeImage = async (url: string): Promise<predictionType[] | null> => {
  const imageBuffer = await (await fetch(url)).arrayBuffer();

  const imageTensor = await node.decodeImage(Buffer.from(imageBuffer), 3) as any;
  const predictions = await model.classify(imageTensor);
  imageTensor.dispose();

  return predictions;
};

app.get('/nsfw', async (req, res) => {
  const url = req.query.url;

  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url query parameter.' });

  const regex =
    /(?:(?:(?:[A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)(?:(?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)(?:\.jpg|\.jpeg|\.png)/;
  if (!regex.test(url)) {
    return res
      .status(400)
      .send({ error: 'Invalid url parameter. Must be a valid PNG, JPG or JPEG image URL.' });
  }

  const predictions = await analyzeImage(url);
  if (!predictions) return res.status(500).json({ error: 'Something went wrong while analyzing the image.' });
  return res.status(200).json(predictions);
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
