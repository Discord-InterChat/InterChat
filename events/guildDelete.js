const { client } = require('../index');
const utils = require('../utils');
const { icons } = require('../emoji.json');


module.exports = {
	name: 'guildDelete',
	async execute(guild) {
		if (!guild.available) return; // If the guild is half-deleted, don't do anything. This is a bug in discord.

		const database = utils.getDb();
		const connectedList = database.collection('connectedList');
		connectedList.deleteOne({ serverId: guild.id });

		const cbhq = client.guilds.fetch(utils.cbhq);
		const goalChannel = (await cbhq).channels.cache.get('906460473065615403');
		await goalChannel.send(`${icons.leave} I have been kicked from ${guild.name}. ${500 - client.guilds.cache.size} to go!`);


	},
};