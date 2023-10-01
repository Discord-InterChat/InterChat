import { GoogleTranslator } from '@translate-tools/core/translators/GoogleTranslator';
import { Scheduler } from '@translate-tools/core/scheduling/Scheduler';

/** Do not use this directly, use scheduler instead to avoid rate limit */
export const translator = new GoogleTranslator();
export const scheduler = new Scheduler(translator, { translatePoolDelay: 100 });

export async function translateText(text: string, to: string, from = 'auto') {
  return await scheduler.translate(text, from, to, { directTranslate: true });
}

