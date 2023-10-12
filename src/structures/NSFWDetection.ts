import { REGEX } from '../utils/Constants.js';

export declare const NSFW_CLASSES: {
  [classId: number]: 'Drawing' | 'Hentai' | 'Neutral' | 'Porn' | 'Sexy';
};

export declare type predictionType = {
  className: typeof NSFW_CLASSES[keyof typeof NSFW_CLASSES];
  probability: number;
};

export default class NSFWDetector {
  public async analyzeImage(url: string): Promise<predictionType[] | null> {
    if (!REGEX.STATIC_IMAGE_URL.test(url)) return null;
    const res = await fetch(`http://localhost:3000/nsfw?url=${url}`);

    return res.status === 200 ? await res.json() : null;
  }

  public isUnsafeContent(predictions: predictionType[]): boolean {
    const safeCategories = ['Neutral', 'Drawing'];

    return predictions.some(
      (prediction) =>
        !safeCategories.includes(prediction.className) &&
        prediction.probability > 0.6,
    );
  }
}