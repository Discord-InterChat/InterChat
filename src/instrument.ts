import * as Sentry from '@sentry/node';
import { isDevBuild } from './utils/Constants.js';
import 'dotenv/config';

if (!isDevBuild) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: process.env.npm_package_version,
    tracesSampleRate: 1.0,
    maxValueLength: 1000,
  });
}
