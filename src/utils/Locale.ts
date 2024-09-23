import Logger from '#main/utils/Logger.js';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { TranslationKeys } from '#main/types/locale.js';

const localesMap = new Map();

export type supportedLocaleCodes = keyof typeof supportedLocales;

export const supportedLocales = {
  bg: { name: 'Bulgarian', emoji: '🇧🇬' },
  cs: { name: 'Czech', emoji: '🇨🇿' },
  da: { name: 'Danish', emoji: '🇩🇰' },
  de: { name: 'German', emoji: '🇩🇪' },
  el: { name: 'Greek', emoji: '🇬🇷' },
  en: { name: 'English', emoji: '🇺🇸' },
  es: { name: 'Spanish', emoji: '🇪🇸' },
  fi: { name: 'Finnish', emoji: '🇫🇮' },
  fr: { name: 'French', emoji: '🇫🇷' },
  // hr: { name: 'Croatian', emoji: '🇭🇷' },
  hu: { name: 'Hungarian', emoji: '🇭🇺' },
  id: { name: 'Indonesian', emoji: '🇮🇩' },
  it: { name: 'Italian', emoji: '🇮🇹' },
  ja: { name: 'Japanese', emoji: '🇯🇵' },
  ko: { name: 'Korean', emoji: '🇰🇷' },
  nl: { name: 'Dutch', emoji: '🇳🇱' },
  no: { name: 'Norwegian', emoji: '🇳🇴' },
  pl: { name: 'Polish', emoji: '🇵🇱' },
  pt: { name: 'Portuguese', emoji: '🇵🇹' },
  ru: { name: 'Russian', emoji: '🇷🇺' },
  sv: { name: 'Swedish', emoji: '🇸🇪' },
  th: { name: 'Thai', emoji: '🇹🇭' },
  tr: { name: 'Turkish', emoji: '🇹🇷' },
  uk: { name: 'Ukrainian', emoji: '🇺🇦' },
  vi: { name: 'Vietnamese', emoji: '🇻🇳' },
  hi: { name: 'Hindi', emoji: '🇮🇳' },
} as const;

export interface tParams<K extends keyof TranslationKeys> {
  phrase: K;
  locale?: supportedLocaleCodes;
}

export const loadLocales = (localesDirectory: string) => {
  const files = fs.readdirSync(localesDirectory);

  files.forEach((file: string) => {
    const filePath = path.join(localesDirectory, file);
    const localeKey = path.basename(file, '.yml');

    const content = fs.readFileSync(filePath, 'utf8');
    const parsedContent = yaml.load(content);

    localesMap.set(localeKey, parsedContent);
  });

  Logger.info(`${localesMap.size} Locales loaded successfully.`);
};

/** Get the translated text with variable replacement */
// skipcq: JS-C1002
export const t = <K extends keyof TranslationKeys>(
  { phrase, locale = 'en' }: tParams<K>,
  variables?: { [Key in TranslationKeys[K]]: string },
): string => {
  const localeFile = localesMap.get(locale) ?? localesMap.get('en');

  if (localeFile) {
    const translation: string = phrase
      .split('.')
      .reduce((obj, segment) => obj?.[segment], localeFile);

    if (translation) {
      // Replace variables in the translated text
      let result = translation;

      if (variables) {
        Object.keys(variables).forEach((variable) => {
          result = result.replace(
            new RegExp(`{${variable}}`, 'g'),
            variables[variable as TranslationKeys[K]],
          );
        });
      }

      return result;
    }
    else {
      Logger.warn(`Translation for key '${phrase}' not found in ${locale} language.`);
    }
  }
  return phrase;
};
