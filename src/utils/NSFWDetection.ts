import 'dotenv/config';

export declare type predictionType = {
  className: 'Drawing' | 'Hentai' | 'Neutral' | 'Porn' | 'Sexy';
  probability: number;
};
/**
 * Analyze an image URL and return the predictions
 * @param imageUrl The image URL
 * @returns The predictions object
 */
export const analyzeImageForNSFW = async (imageUrl: string): Promise<predictionType[] | null> => {
  const res = await fetch(`http://localhost:${process.env.PORT}/nsfw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });

  return res.status === 200 ? await res.json() : null;
};

/**
 * Check if the predictions are unsafe
 * @param predictions The predictions to check
 * @returns Whether the predictions are unsafe
 */
export const isUnsafeImage = (predictions: predictionType[]): boolean => {
  const safeCategories = ['Neutral', 'Drawing'];

  const [topPrediction] = predictions;
  return !safeCategories.includes(topPrediction.className) && topPrediction.probability > 0.7;
};
