import { createLogger, format, transports } from 'winston';

const custom = format.printf((info) => {
	if (!info.stack) return `${info.level}: ${info.message} | ${info.timestamp}`;

	return `${info.level}: ${info.message} | ${info.timestamp}\n${info.stack}`;
});

const infoFormat = format.combine(
	format.timestamp({ format: '[on] DD MMMM, YYYY [at] hh:mm:ss.SSS' }),
	format((info) => {
		info.level = info.level.toUpperCase();
		if (info.level === 'ERROR') return false;
		return info;
	})(),
	custom,
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

const logger = createLogger({
	format: combinedFormat,
	transports: [
		new transports.File({ filename: 'logs/discord.log', format: infoFormat }),
		new transports.File({ filename: 'logs/error.log', level: 'error' }),
		new transports.Console({ format: format.combine(format.colorize(), custom) }),
	],
});

export default logger;
