const { createLogger, format, transports } = require('winston');

const custom = format.printf((info) => {
	if (info.stack == undefined) return `${info.level}: ${info.message} | ${info.timestamp}`;

	return `${info.level}: ${info.message} | ${info.timestamp}\n${info.stack}`;
});

// eslint-disable-next-line no-unused-vars
const logger = createLogger({
	format: format.combine(
		format.timestamp({ format: '[on] DD MMMM, YYYY [at] hh:mm:ss.SSS' }),
		format(info => {
			info.level = info.level.toUpperCase();
			return info;
		})(),
		custom,
	),
	transports: [
		new transports.Console({
			format: format.combine(
				format.timestamp({ format: '[on] DD MMMM, YYYY [at] hh:mm:ss.SSS' }),
				format(info => {
					info.level = info.level.toUpperCase();
					return info;
				})(),
				format.colorize(),
				custom,
			),
		}),
		new transports.File({ filename: 'logs/error.log', level: 'error' }),

		// error logs should not get into discord logs and clutter things up.
		new transports.File({ filename: 'logs/discord.log', level: 'warn' }),
		new transports.File({ filename: 'logs/discord.log', level: 'info' }),
	],
});

module.exports = logger;