const { client } = require('../index');
const utils = require('../utils');
const mongoUtil = require('../utils');


module.exports = {
	name: 'guildDelete',
	async execute(guild) {
		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');
		connectedList.deleteOne({ serverId: guild.id });

		const cbhq = client.guilds.fetch(utils.cbhq);
		const goalChannel = (await cbhq).channels.cache.get('982525830305550386'); // FIXME: Change with 906460473065615403 later
		await goalChannel.send(`I have been kicked from ${guild.name} 😢. ${500 - client.guilds.cache.size} to go!`);


	},
};