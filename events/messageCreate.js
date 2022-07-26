const { EmbedBuilder, Message } = require('discord.js');
const { getDb, colors } = require('../utils');
const { messageTypes } = require('../scripts/message/messageTypes');
const logger = require('../logger');
const evalScript = require('../scripts/message/evalScript');
const wordFilter = require('../scripts/message/wordFilter');
const Filter = require('bad-words'),
	filter = new Filter();

// TODO Replace bad-words with leo-profanity as it provides the entire list of bad words it uses.

// TODO: edit the embed instead of changing the message content
// if guild has profanity disabled and has embeds on set the embed to normal desc :DDDDDDDDDDDDD

// TODO: Warning and timed blacklist system
// blacklist a user for a specific amount of time if they have over x warns
// might come in handy in other cases too.

module.exports = {
	name: 'messageCreate',
	/**
   * @param {Message} message
   * @returns
   */
	async execute(message) {
		if (message.author.bot) return;
		if (message.content.startsWith('c!eval')) evalScript.execute(message);

		// main db where ALL connected channel data is stored
		const database = getDb();
		const connectedList = database.collection('connectedList');

		// db for setup data
		const setup = database.collection('setup');
		const channelInNetwork = await connectedList.findOne({
			channelId: message.channel.id,
		});


		if (channelInNetwork) {
			const checks = await require('../scripts/message/checks').execute(message, database);
			if (checks === false) return;

			// check if message contains profanity
			if (filter.isProfane(message.content)) message.content = wordFilter.censor(message);

			require('../scripts/message/levelling').execute(message);

			const allConnectedChannels = await connectedList.find();

			const embed = new EmbedBuilder()
				.setTimestamp()
				.setColor(colors())
				.addFields([
					{
						name: 'Message',
						value: message.content || '\u200B',
						inline: false,
					},
				])
				.setAuthor({
					name: message.author.tag,
					iconURL: message.author.avatarURL(),
					url: `https://discord.com/users/${message.author.id}`,
				})
				.setFooter({
					text: `From: ${message.guild}┃${message.guild.id}`,
					iconURL: message.guild.iconURL(),
				});

			await require('../scripts/message/addBadges').execute(message, database, embed);
			await require('../scripts/message/messageContentModifiers').execute(message, embed);

			// delete the message only if it doesn't contain images
			if (message.attachments.first() === undefined) {
				try {
					await message.delete();
				}
				catch (err) {
					logger.warn(err + ' cannot delete message');
				}
			}

			// NOTE: Using the db used here in other chatbot's will end up deleting all servers when you send a message... so be careful XD
			allConnectedChannels.forEach(async (channelObj) => {
				try {
					await message.client.channels.fetch(channelObj.channelId);
				}
				catch {
					await connectedList.deleteOne({ channelId: channelObj.channelId });
					await setup.deleteOne({ 'channel.id': channelObj.channelId });
					logger.warn(`Deleted non-existant channel ${channelObj.channelId} from database.`);
					return;
				}
				await messageTypes(message.client, message, channelObj, embed, setup);
			});
		}
		else {
			return;
		}
	},
};
