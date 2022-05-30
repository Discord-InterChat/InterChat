/* eslint-disable no-inline-comments */
const { MessageEmbed } = require('discord.js');
const logger = require('../logger');
const mongoUtil = require('../utils');
const { colors } = require('../utils');
const { client } = require('../index');
const { messageTypes } = require('../scripts/message/messageTypes');
module.exports = {
	name: 'messageCreate',
	async execute(message) {
		if (message.author.bot) return;

		if (message.content.startsWith('c!help') || message.content.startsWith('c!connect') || message.content.startsWith('c!disconnect')) {
			await message.reply('ChatBot does not respond to any commands with the prefix `c!` anymore since we have switched to slash commands! Please type / and check out the list of commands!');
			return;
		}
		// if (message.content.startsWith('!eval')) await require('../scripts/eval-temp/eval').eval(message);

		// main db where ALL connected channel data is stored
		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');

		// db for setup data
		const setup = database.collection('setup');
		const channelInNetwork = await connectedList.findOne({ channelId: message.channel.id });

		/**
		 *
		 * @param {*} embed The Embed object
		 */
		async function sendInCatch(embed) {
			/*
			Find an alternative for this:
			1. it sends 2 messages when initiated (probably cause of 2 foreach loops)
			2. you have to do same thing from messageTypes function here...
			*/

			// Gives Maximum call stack size exceeded error [bug]
			const newConnectedChannels = await connectedList.find({});
			newConnectedChannels.forEach(async element => {
				await messageTypes(client, message, element, embed, setup);
			});
		}

		// Checks if channel is in databse, rename maybe?
		if (channelInNetwork) {
			const userInBlacklist = await database.collection('blacklistedUsers').findOne({ userId: message.author.id });
			if (userInBlacklist) {
				await message.reply(`You are blacklisted from using the ChatBot Chat Network for reason \`${userInBlacklist.reason}\`! Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
				return;
			}

			if (message.content.includes('@everyone') || message.content.includes('@here')) {
				await message.channel.send('Haha good try, but you just pinged your own server 😆.');
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

			// DONE: maybe do something similar for our rather 'big' messageTypes function?
			await require('../scripts/message/addBadges').execute(message, database, embed);
			await require('../scripts/message/messageContentModifiers').execute(message, embed);

			try {
				await message.delete();
			}
			catch (err) {
				logger.warn(err + ' cannot delete message');
			}

			const deletedChannels = [];


			allConnectedChannels.forEach(async channelObj => {
				try {
					// trying to fetch all channels to see if they exist
					await client.channels.fetch(channelObj.channelId);
				}
				catch (e) {
					console.log('Inside Catch');
					// if channels doesn't exist (thats probably why its in catch block in the first place (ʘ ͟ʖ ʘ))
					// push to deletedChannels array and delete later
					deletedChannels.push(channelObj.channelId);
					console.log(e);
					await connectedList.deleteMany({
						channelId: {
							$in: deletedChannels,
						},
					});
					// deleting the channels that was pushed to the array earlier from the databse
					await setup.deleteMany({
						channelId: {
							$in: deletedChannels, // Note: $in only takes array
						},
					});
					// replace this with something that doesnt iterate twise idk lmao [change]
					await sendInCatch(connectedList, embed);
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