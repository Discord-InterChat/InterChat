import * as Sentry from '@sentry/node';
import { isDevBuild, PROJECT_VERSION } from './utils/Constants.js';
import 'dotenv/config';

if (!isDevBuild) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: `interchat@${PROJECT_VERSION}`,
    tracesSampleRate: 1.0,
    maxValueLength: 1000,
  });
}
