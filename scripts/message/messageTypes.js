const logger = require('../../logger');

module.exports = {
/**
     *
     * @param {Object} message The discord message object not the message string
     * @param {Object} channelObj Sending message in the right channel object | Takes discord.js channel object
     * @param {*} embed The Embed you want to send to the channel | Takes discord.js embed object
     * @param {*} setupDb the database you are using as your 'setup' databse
     */

	async messageTypes(client, message, channelObj, embed, setupDb) {
		const allChannel = await client.channels.fetch(channelObj.channelId);
		// fetching again to get updated results from the DB
		const channelInDB = await setupDb.findOne({ 'channel.id': allChannel.id });
		const webhookAutomate = async (chan) => {
			try {
				const webhooks = await chan.fetchWebhooks();
				const webhook = webhooks.find(wh => wh.token);

				if (!webhook) {
					return await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
				}

				await webhook.send({ content: message.content, username: message.author.username, avatarURL: message.author.avatarURL() });
				logger.info('semt');
			}
			catch (error) {
				console.error('Error trying to send webhook message: ', error);
			}
		};

		// if channel is in setup db then enter this (do not edit as it will return null and break everything)
		if (channelInDB && channelInDB.isEmbed === false && allChannel == message.channel.id) {
			webhookAutomate(message.channel);
			// await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
		}
		else if (channelInDB && channelInDB.isEmbed === false && allChannel == channelInDB.channel.id) {
			webhookAutomate(allChannel);
			// await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
		}
		else {
			await allChannel.send({ embeds: [embed] });
		}
	},

};