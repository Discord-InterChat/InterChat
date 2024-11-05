export interface NSFWPrediction {
  is_nsfw: boolean;
  confidence_percentage: number;
};

export default class NSFWDetector {
  readonly imageURL: string;
  private readonly endpoint = 'http://localhost:8000/v1/detect/urls';
  constructor(imageURL: string) {
    this.imageURL = imageURL;
  }

  async analyze(): Promise<NSFWResult> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [this.imageURL] }),
    });

    const data = await res.json();
    if (res.status !== 200) throw new Error('Failed to analyze image:', data);
    return new NSFWResult(data);
  }
}

class NSFWResult {
  private readonly rawResults;
  constructor(rawResults: NSFWPrediction[]) {
    this.rawResults = rawResults;
  }

  get isNSFW(): boolean {
    return this.rawResults.some((result) => result.is_nsfw);
  }

  get confidence(): number {
    return this.rawResults.reduce((acc, result) => acc + result.confidence_percentage, 0) / this.rawResults.length;
  }

  public exceedsSafeThresh(minConfidence = 80): boolean {
    // currently only checking the first prediction
    // since we never broadcast multiple images at once
    const prediction = this.rawResults[0];
    return Boolean(prediction.confidence_percentage >= minConfidence);
  }
}

