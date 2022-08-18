const logger = require('../utils/logger');
const utils = require('../utils/functions/utils');
const { ActivityType } = require('discord.js');
require('dotenv').config();
const { topgg } = require('../utils/functions/utils');

module.exports = {
	name: 'ready',
	once: true,

	async execute(client) {
		/* FIXME: Uncomment this when on main CB
		topgg.postStats({
			serverCount: client.guilds.cache.size,
		}); */

		async function clearOldMessages() {
			const FOUR_HOURS = 60 * 60 * 4000; // four hours in milliseconds
			const older_than = new Date(Date.now() - FOUR_HOURS); // 4 hours before now

			const db = utils.getDb();
			const messageInDb = db.collection('messageData');

			await messageInDb.deleteMany({ timestamp: { $lte: older_than.getTime() } })
				.deletedCount; // if timestamp is less or equal to 4 hours before now delete it
		}
		setInterval(clearOldMessages, 60 * 60 * 4500);
		logger.info(`Logged in as ${client.user.tag}`);
	},
};