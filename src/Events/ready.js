const logger = require('../utils/logger');
const { mainGuilds } = require('../utils/functions/utils');
const { ActivityType } = require('discord.js');
require('dotenv').config();
// const { topgg } = require('../utils');

module.exports = {
	name: 'ready',
	once: true,

	async execute(client) {
		// if bot is run using dev command (npm run dev) then deploy commands to known test servers
		if (process.env.DEV) {
			Object.values(mainGuilds)
				.forEach(element => client.guilds.fetch(element)
					.then(guild => {return guild.commands.set(client.commands.map(cmd => cmd.data));})
					.then(() => logger.info('(/) Loaded all application commands to test guilds.'))
					.catch(logger.error));
			logger.warn('Bot is in development mode.');
		}

		/* FIXME: Uncomment this when on main CB
		topgg.postStats({
			serverCount: client.guilds.cache.size,
		}); */

		client.user.setPresence({
			activities: [{
				name: client.version,
				type: ActivityType.Playing,
			}],
		});
		logger.info(`Logged in as ${client.user.tag}`);

	},
};