const { EmbedBuilder, Client, Message, Channel } = require('discord.js');
const { normal } = require('../../emoji.json');
const logger = require('../../logger');

/**
 * @param {Client} client The discord. client session/object, use interaction.client if you are in a command handler
 * @param {Message} message The discord message object not the message string
 * @param {Channel} channelObj Sending message in the right channel object
 * @param {EmbedBuilder} embed The Embed you want to send to the channel
 */
async function messageTypes(client, message, channelObj, embed, setupDb) {
	const allChannel = await client.channels.fetch(channelObj.channelId);
	// fetching again to get updated results from the DB
	const channelInDB = await setupDb.findOne({ 'channel.id': allChannel.id });
	const webhookAutomate = async (chan) => {
		try {
			const webhooks = await chan.fetchWebhooks();
			const webhook = webhooks.find(wh => wh.token);

			if (!webhook) {
				return await allChannel.send(({
					content: `**${message.author.tag}:** ${message.content}`,
					allowedMentions: { parse: [] },
				}));
			}

			await webhook.send({
				content: message.content,
				username: message.author.username,
				avatarURL: message.author.avatarURL(),
				allowedMentions: { parse: [] },
			});
			logger.info('sent');
		}
		catch (error) {
			allChannel.send(`${normal.no} Unable to send webhook message! \n**Error:** ${error.message}`);
		}
	};

	// if channel is in setup db then enter this (do not edit as it will return null and break everything)
	if (channelInDB && channelInDB.compact === true && allChannel == message.channel.id) {
		webhookAutomate(message.channel);
		// await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
	}
	else if (channelInDB && channelInDB.compact === true && allChannel == channelInDB.channel.id) {
		webhookAutomate(allChannel);
		// await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
	}
	else {
		await allChannel.send({ embeds: [embed], allowedMentions: { parse: ['roles'] } });
	}
}
module.exports = { messageTypes };