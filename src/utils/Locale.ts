import { I18n } from 'i18n';
import YAML from 'yaml';
import Logger from './Logger.js';

const { configure, __ } = new I18n();

export function initI18n() {
  configure({
    directory: './locales',
    defaultLocale: 'en',
    fallbacks: { '*': 'en' },
    retryInDefaultLocale: true,
    objectNotation: true,
    parser: YAML,
    extension: '.yml',
    logDebugFn: Logger.debug,
    logWarnFn: Logger.warn,
    logErrorFn: Logger.error,
  });
}

// i18n is cjs :(
export { __ as t };
