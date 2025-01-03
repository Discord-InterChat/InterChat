import { createLogger, format, transports } from 'winston';

const custom = format.printf(
  (info) =>
    `\x1b[2;37m${info.timestamp}\x1b[0m ${info.level}: ${info.message} ${info.stack ? `\n${info.stack}` : ''}`,
);

const combinedFormat = format.combine(
  format.errors({ stack: true }),
  format.splat(),
  format.timestamp({ format: 'DD/MM/YY-HH:mm:ss' }),
  format((info) => {
    info.level = info.level.toUpperCase();
    return info;
  })(),
  custom,
);

export default createLogger({
  format: combinedFormat,
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), custom),
      level: process.env.DEBUG === 'true' ? 'debug' : 'info',
    }),
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
      filename: 'logs/info.log',
      format: format.combine(
        format((info) => (info.level === 'INFO' ? info : false))(),
        combinedFormat,
      ),
    }),
  ],
});
