import { I18n } from 'i18n';
import YAML from 'yaml';
import Logger from './Logger.js';

const { configure, __ } = new I18n();

export function initI18n(locale = 'en') {
  configure({
    directory: './locales',
    fallbacks: { '*': locale },
    objectNotation: true,
    parser: YAML,
    extension: '.yml',
    logDebugFn: Logger.debug,
    logWarnFn: Logger.warn,
    logErrorFn: Logger.error,
  });
}

// i18n is cjs :(
export { __ };
