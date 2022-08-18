const utils = require('../utils/functions/utils');
const channelIds = require('../utils/discordIds.json');
const { icons } = require('../utils/emoji.json');


module.exports = {
	name: 'guildDelete',
	async execute(guild) {
		const database = utils.getDb();
		const connectedList = database.collection('connectedList');
		connectedList.deleteOne({ serverId: guild.id });

		const cbhq = guild.client.guilds.fetch(utils.mainGuilds.cbhq);
		const goalChannel = (await cbhq).channels.cache.get(channelIds.channel.goal);
		await goalChannel.send({
			content: `${icons.leave} I have been kicked from ${guild.name}. ${500 - guild.client.guilds.cache.size} to go!`,
			allowedMentions: { parse: ['everyone', 'roles'] },
		});
	},
};