import { REGEX } from '../utils/Constants.js';

export declare type predictionType = {
  className: 'Drawing' | 'Hentai' | 'Neutral' | 'Porn' | 'Sexy';
  probability: number;
};

export default class NSFWDetector {
  /**
   * Analyze an image URL and return the predictions
   * @param url The image URL
   * @returns The predictions
   */
  public async analyzeImage(url: string): Promise<predictionType[] | null> {
    if (!REGEX.STATIC_IMAGE_URL.test(url)) return null;
    const res = await fetch(`http://localhost:3000/nsfw?url=${url}`);

    return res.status === 200 ? await res.json() : null;
  }

  /**
   * Check if the predictions are unsafe
   * @param predictions The predictions to check
   * @returns Whether the predictions are unsafe
   */
  public isUnsafeContent(predictions: predictionType[]): boolean {
    const safeCategories = ['Neutral', 'Drawing'];

    return predictions.some(
      (prediction) =>
        !safeCategories.includes(prediction.className) && prediction.probability > 0.6,
    );
  }
}
