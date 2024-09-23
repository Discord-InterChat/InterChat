import 'dotenv/config';

export declare type predictionType = {
  is_nsfw: boolean;
  confidence_percentage: number;
};
/**
 * Analyze an image URL and return the predictions
 * @param imageURL The image URL
 * @returns The predictions object
 */
export const analyzeImageForNSFW = async (imageURL: string): Promise<predictionType[]> => {
  const res = await fetch('http://localhost:8000/v1/detect/urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: [imageURL] }),
  });

  const data = await res.json();
  if (res.status !== 200) throw new Error(`Failed to analyze image: ${data}`);
  return data as predictionType[];
};

/**
 * Check if the predictions are unsafe
 * @param predictions The predictions to check
 * @returns Whether the predictions are unsafe
 */
export const isImageUnsafe = (prediction: predictionType, maxConfidence = 90): boolean =>
  prediction.is_nsfw && prediction.confidence_percentage >= maxConfidence;
