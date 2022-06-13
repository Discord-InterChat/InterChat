/* eslint-disable no-inline-comments */
const { MessageEmbed } = require('discord.js');
const logger = require('../logger');
const { getDb, colors } = require('../utils');
const { client } = require('../index');
const { messageTypes } = require('../scripts/message/messageTypes');
const wordFilter = require('../scripts/message/wordFilter');
const Filter = require('bad-words'),
	filter = new Filter();

module.exports = {
	name: 'messageCreate',
	async execute(message) {
		if (message.author.bot) return;

		if (message.content.startsWith('c!help') || message.content.startsWith('c!connect') || message.content.startsWith('c!disconnect')) {
			await message.reply('ChatBot does not respond to any commands with the prefix `c!` anymore since we have switched to slash commands! Please type / and check out the list of commands!');
			return;
		}

		// main db where ALL connected channel data is stored
		const database = getDb();
		const connectedList = database.collection('connectedList');

		// db for setup data
		const setup = database.collection('setup');
		const channelInNetwork = await connectedList.findOne({ channelId: message.channel.id });

		// db for blacklisted words
		const restrictedWords = database.collection('restrictedWords');
		const wordList = await restrictedWords.findOne({ name: 'blacklistedWords' });

		// Checks if channel is in databse, rename maybe?
		if (channelInNetwork) {
			let prohibited;
			// check if message contains prohibited words
			wordList.words.forEach(v => {
				// return if message contains blacklisted words (slurs)
				// and log it to staff logs channel
				if (message.content.toLowerCase().includes(v)) {
					wordFilter.log(message);
					prohibited = true;
					return message.author.send('That word has been blacklisted by the developers.');
				}
			});
			if (prohibited === true) return;

			// if (message.content.includes('@everyone') || message.content.includes('@here')) {
			// 	return;
			// }
			// filter bad words
			if (filter.isProfane(message.content)) {
				message.content = await wordFilter.execute(message);
			}
			const userInBlacklist = await database.collection('blacklistedUsers').findOne({ userId: message.author.id });
			if (userInBlacklist) {
				// TODO: Send message to author not the channel.
				// await message.author.send(`You are blacklisted from using the ChatBot Chat Network for reason \`${userInBlacklist.reason}\`! Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
				return;
			}

			const allConnectedChannels = await connectedList.find();

			const embed = new MessageEmbed()
				.setTimestamp()
				.setColor(colors())
				.setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL({ dynamic: true }), url: `https://discord.com/users/${message.author.id}` })
				.setFooter({ text: `From: ${message.guild}┃${message.guild.id}`, iconURL: message.guild.iconURL({ dynamic: true }) })
				.addFields([
					{ name: 'Message', value: message.content || '\u200B', inline: false }]);

			await require('../scripts/message/addBadges').execute(message, database, embed);
			await require('../scripts/message/messageContentModifiers').execute(message, embed);

			// delete the message only if it doesn't contain images
			if (message.attachments.first() === undefined) {
				try {await message.delete();}
				catch (err) {logger.warn(err + ' cannot delete message');}
			}
			const deletedChannels = [];

			// NOTE: Using the db used here in other chatbot's will end up deleting all servers when you send a message... so be careful XD
			allConnectedChannels.forEach(async channelObj => {
				try {
					// trying to fetch all channels to see if they exist
					await client.channels.fetch(channelObj.channelId);
				}
				catch (e) {
					// if channels doesn't exist push to deletedChannels array
					logger.error(e);
					deletedChannels.push(channelObj.channelId);
					await connectedList.deleteMany({
						channelId: {
							$in: deletedChannels,
						},
					});
					// deleting the channels that was pushed to deletedChannels earlier, from the databse
					await setup.deleteMany({
						'channel.id': {
							$in: deletedChannels, // NOTE: $in only takes array
						},
					});
					/*
					 * REVIEW: replace this with something that doesnt iterate twise idk lmao
					 * REVIEW: This suddenly started to work, make sure it really does and isnt luck! Bug testing or something
					*/
					return;
				}
				await messageTypes(client, message, channelObj, embed, setup);

			});
		}
		else {
			return;
		}
	},
};