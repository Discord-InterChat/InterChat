import { Client } from 'discord.js';
import { getDb } from '../Utils/functions/utils';
import logger from '../Utils/logger';
// import { constants } from '../Utils/functions/utils';

export default {
	name: 'ready',
	once: true,
	async execute(client: Client) {
		const db = getDb();
		const messageData = db.messageData;
		const FOUR_HOURS = 60 * 60 * 4000;

		// set a property called "expired" to a document that is older than 4 hours.
		setInterval(async () => {
			const older_than_four = new Date(Date.now() - FOUR_HOURS); // 4 hours before now
			await messageData.updateMany({
				where: { timestamp: { lte: older_than_four.getTime() } },
				data: { expired: true },
			});

		}, 60 * 60 * 4500);

		// Delete all documents that have the property "expired" set to true.
		setInterval(async () => {
			await messageData?.deleteMany({ where: { expired: true } });
		}, 60 * 60 * 12_000);

		// constants.topgg.postStats({ serverCount: client.guilds.cache.size });

		logger.info(`Logged in as ${client.user?.tag}!`);
	},
};
