import { createLogger, format, transports } from 'winston';

const custom = format.printf(
  (info) =>
    `${info.level}: ${info.message} | ${info.timestamp} ${info.stack ? `\n${info.stack}` : ''}`,
);

const combinedFormat = format.combine(
  format.errors({ stack: true }),
  format.timestamp({ format: '[on] DD MMMM, YYYY [at] hh:mm:ss.SSS' }),
  format((info) => {
    info.level = info.level.toUpperCase();
    return info;
  })(),
  custom,
);

export default createLogger({
  format: combinedFormat,
  transports: [
    new transports.Console({ format: format.combine(format.colorize(), custom) }),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({
      filename: 'logs/debug.log',
      level: 'debug',
      format: format.combine(
        format((info) => (info.level === 'DEBUG' ? info : false))(),
        combinedFormat,
      ),
    }),
    new transports.File({
      filename: 'logs/discord.log',
      format: format.combine(
        format((info) => (info.level === 'INFO' ? info : false))(),
        combinedFormat,
      ),
    }),
  ],
});
