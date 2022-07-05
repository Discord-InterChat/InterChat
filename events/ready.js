const logger = require('../logger');
// const { topgg } = require('../utils');

module.exports = {
	name: 'ready',
	once: true,
	/**
	 * @param {import ('discord.js').Client} client
	 */
	async execute(client) {
		logger.info(`Logged in as ${client.user.tag}`);

		const activities = [
			{ name: `${client.guilds.cache.size} servers! 👀`, type: 'WATCHING' },
			{ name: `with ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} users`, type: 'PLAYING' },
		];
		setInterval(() => {
			// generate random number between 1 and list length.
			const randomIndex = Math.floor(Math.random() * (activities.length - 1) + 1);
			const newActivity = activities[randomIndex];

			client.user.setActivity(newActivity);
		}, 300000);


		/* FIXME: Uncomment this when on main CB
		topgg.postStats({
			serverCount: client.guilds.cache.size,
		}); */


	},
};