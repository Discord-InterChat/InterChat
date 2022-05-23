const logger = require('../logger');

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {
		client.user.setPresence({ status: '' });
		logger.info(`Logged in as ${client.user.tag}`);
	},
};