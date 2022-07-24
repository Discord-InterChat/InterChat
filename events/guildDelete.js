const utils = require('../utils');
const { icons } = require('../emoji.json');


module.exports = {
	name: 'guildDelete',
	async execute(guild) {
		const database = utils.getDb();
		const connectedList = database.collection('connectedList');
		connectedList.deleteOne({ serverId: guild.id });

		const cbhq = guild.client.guilds.fetch(utils.mainGuilds.cbhq);
		const goalChannel = (await cbhq).channels.cache.get('906460473065615403');
		await goalChannel.send(`${icons.leave} I have been kicked from ${guild.name}. ${500 - guild.client.guilds.cache.size} to go!`);


	},
};