import { Client } from 'discord.js';
import logger from '../Utils/logger';
import utils from '../Utils/functions/utils';
import 'dotenv/config';
// import { constants } from '../Utils/functions/utils';

export default {
	name: 'ready',
	once: true,

	async execute(client: Client) {
		// FIXME: Uncomment this when on main CB
		// constants.topgg.postStats({serverCount: client.guilds.cache.size});

		const db = utils.getDb();
		const FOUR_HOURS = 60 * 60 * 4000;

		// set a property called "expired" to a document that is older than 4 hours.
		setInterval(async () => {
			const older_than_four = new Date(Date.now() - FOUR_HOURS); // 4 hours before now
			const messageInDb = db?.collection('messageData');
			await messageInDb?.updateMany({ timestamp: { $lte: older_than_four.getTime() } }, { $set: { expired: true } });

		}, 60 * 60 * 4500);

		// Delete expired documents every 12 hours
		setInterval(async () => {
			const messageInDb = db?.collection('messageData');
			await messageInDb?.deleteMany({ expired: true });
		}, 60 * 60 * 12_000);


		logger.info(`Logged in as ${client.user?.tag}`);
	},
};