const { EmbedBuilder } = require('discord.js');
const { getDb, colors } = require('../utils/functions/utils');
const logger = require('../utils/logger');
const messageContentModifiers = require('../scripts/message/messageContentModifiers');
const evalScript = require('../scripts/message/evalScript');
const wordFilter = require('../scripts/message/wordFilter');

// TODO: edit the embed instead of changing the message content
// if guild has profanity disabled and has embeds on set the embed to normal desc :DDDDDDDDDDDDD

// TODO: Warning and timed blacklist system
// blacklist a user for a specific amount of time if they have over x warns
// might come in handy in other cases too.

module.exports = {
	name: 'messageCreate',
	async execute(message) {
		if (message.author.bot) return;
		// FIXME c! on main cb
		if (message.content.startsWith('cb!eval')) evalScript.execute(message);

		// main db where ALL connected channel data is stored
		const database = getDb();
		const connectedList = database.collection('connectedList');

		// db for setup data
		const setup = database.collection('setup');
		const channelInNetwork = await connectedList.findOne({
			channelId: message.channel.id,
		});

		const messageData = database.collection('messageData');

		if (channelInNetwork) {
			const checks = await require('../scripts/message/checks').execute(message, database);
			if (checks === false) return;

			// check if message contains profanity and censor it if it does
			message.content = wordFilter.checkAndCensor(message);

			const allConnectedChannels = await connectedList.find().toArray();

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
			await messageContentModifiers.execute(message, embed);

			const attachments = await messageContentModifiers.attachmentModifiers(message, embed);

			// leveling system
			await require('../scripts/message/levelling').execute(message);

			try {
				await message.delete();
			}
			catch (err) {
				logger.warn(err + ' cannot delete message');
			}


			const channelAndMessageIds = [];

			for (const channelObj of allConnectedChannels) {
				try {
					await message.client.channels.fetch(channelObj.channelId);
				}
				catch {
					await connectedList.deleteOne({ channelId: channelObj.channelId });
					await setup.deleteOne({ 'channel.id': channelObj.channelId });
					logger.warn(`Deleted non-existant channel ${channelObj.channelId} from database.`);
					return;
				}
				// sending the messages to the connected channels
				const msg = await require('../scripts/message/messageTypes').execute(message.client, message, channelObj, embed, setup, attachments);
				channelAndMessageIds.push({ channelId: msg.channelId, messageId: msg.id });
			}

			// for editing and deleting messages
			messageData.insertOne({
				channelAndMessageIds,
				timestamp: message.createdTimestamp,
				authorId: message.author.id,
				serverId: message.guild.id,
			});
		}
		else {
			return;
		}
	},
};
