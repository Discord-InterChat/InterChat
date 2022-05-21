module.exports = {
/**
     *
     * @param {*} message
     * @param {Object} channelObj Sending message in the right channel object | Takes discord.js channel object
     * @param {*} embed The Embed you want to send to the channel | Takes discord.js embed object
     * @param {*} setupDb the database constant you are using as your 'setup' databse
     */

	async messageTypes(client, message, channelObj, embed, setupDb) {
		const allChannel = await client.channels.fetch(channelObj.channelId);
		// Probably fetching again to get updated results from the DB [review]
		const channelInDB = await setupDb.findOne({ 'channelId': allChannel.id });

		// if channel is in setup db then enter this (do not edit as it will return null and break everything)
		// also why did I use guildIndb and not channelInDB?? (edited now I hope it doesnt break stuff lmao)
		if (channelInDB && channelInDB.isEmbed === false && allChannel == message.channel.id) {
			await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
		}
		else if (channelInDB && allChannel == channelInDB.channelId && channelInDB.isEmbed === false) {
			await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
		}
		else {
			await allChannel.send({ embeds: [embed] });
		}
	},

};