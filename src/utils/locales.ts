import { I18n } from 'i18n';
import Logger from './Logger.js';
import YAML from 'yaml';

const i18n = new I18n();

i18n.configure({
  directory: './locales',
  fallbacks: { '*': 'en' },
  objectNotation: true,
  parser: YAML,
  extension: '.yml',
  logDebugFn: Logger.info,
  logWarnFn: Logger.warn,
  logErrorFn: Logger.error,
});

export default i18n.__;
