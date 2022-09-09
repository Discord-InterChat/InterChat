import { Client } from 'discord.js';
import logger from '../Utils/logger';
import utils from '../Utils/functions/utils';
import { config } from 'dotenv';
config();
// import { constants } from '../Utils/functions/utils';

export default {
	name: 'ready',
	once: true,

	async execute(client: Client) {
		/* FIXME: Uncomment this when on main CB
		constants.topgg.postStats({
			serverCount: client.guilds.cache.size,
		}); */

		async function clearOldMessages() {
			const FOUR_HOURS = 60 * 60 * 4000; // four hours in milliseconds
			const older_than = new Date(Date.now() - FOUR_HOURS); // 4 hours before now

			const db = utils.getDb();
			const messageInDb = db?.collection('messageData');

			await messageInDb?.deleteMany({ timestamp: { $lte: older_than.getTime() } }); // if timestamp is less or equal to 4 hours before now delete it
		}
		setInterval(clearOldMessages, 60 * 60 * 4500);
		logger.info(`Logged in as ${client.user?.tag}`);
	},
};