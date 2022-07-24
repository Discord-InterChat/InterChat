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
			client.guilds.fetch(mainGuilds.botTest).then(guild => { guild.commands.set(client.commands.map(cmd => cmd.data));});
			client.guilds.fetch(mainGuilds.cbTest).then(guild => { guild.commands.set(client.commands.map(cmd => cmd.data));});
			logger.warn('Bot is in development mode. (/) Loading commands to development guilds...');
		}

		/* FIXME: Uncomment this when on main CB
		topgg.postStats({
			serverCount: client.guilds.cache.size,
		}); */

	},
};