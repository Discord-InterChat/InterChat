const logger = require('../logger');
const { mainGuilds } = require('../utils');
require('dotenv').config();
// const { topgg } = require('../utils');

module.exports = {
	name: 'ready',
	once: true,
	/**
	 * @param {import ('discord.js').Client} client
	 */
	async execute(client) {

		logger.info(`Logged in as ${client.user.tag}`);

		// if bot is run using dev command (npm run dev) then deploy commands to known test servers
		if (process.env.DEV) {
			logger.warn('Bot is in development mode.');

			Object.values(mainGuilds)
				.forEach(element => client.guilds.fetch(element)
					.then(guild => {return guild.commands.set(client.commands.map(cmd => cmd.data));})
					.then(() => logger.info('(/) Loaded all application commands to test guilds.'))
					.catch(logger.error));
		}

		/* FIXME: Uncomment this when on main CB
		topgg.postStats({
			serverCount: client.guilds.cache.size,
		}); */

	},
};