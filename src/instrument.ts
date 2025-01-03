import Constants from '#utils/Constants.js';
import * as Sentry from '@sentry/bun';

if (!Constants.isDevBuild) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: `interchat@${Constants.ProjectVersion}`,
    tracesSampleRate: 1.0,
    maxValueLength: 1000,
    integrations: [
      Sentry.onUncaughtExceptionIntegration({ exitEvenIfOtherHandlersAreRegistered: false }),
    ],
  });
}
