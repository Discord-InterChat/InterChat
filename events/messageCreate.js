/* eslint-disable no-inline-comments */
const { EmbedBuilder } = require('discord.js');
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

		// main db where ALL connected channel data is stored
		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');

		// db for setup data
		const setup = database.collection('setup');

		// const guildInDB = await setup.findOne({ 'guildId': message.guild.id });
		const channelInNetwork = await connectedList.findOne({ channelId: message.channel.id });

		/**
		 *
		 * @param {EmbedBuilder} embed Takes discord.js embed object
		 */
		async function sendInCatch(embed) {
			/*
			Find an alternative for this:
			1. it sends 2 messages when initiated (probably cause of 2 foreach loops)
			2. you have to do same thing from messageTypes function here...
			*/
			const newConnectedChannels = await connectedList.find({});
			newConnectedChannels.forEach(async element => {
				await messageTypes(client, message, element, embed, setup);
			});
		}

		// /**
		//  *
		//  * @param {Object} channelObj Sending message in the right channel object | Takes discord.js channel object
		//  * @param {EmbedBuilder} embed The Embed you want to send to the channel | Takes discord.js embed object
		//  * @returns
		//  */
		// async function messageTypes(channelObj, embed) {
		// 	const allChannel = await client.channels.fetch(channelObj.channelId);
		// 	// Probably fetching again to get updated results from the DB [review]
		// 	const channelInDB = await setup.findOne({ 'channelId': allChannel.id });

		// 	// if channel is in setup db then enter this (do not edit as it will return null and break everything)
		// 	// also why did I use guildIndb and not channelInDB?? (edited now I hope it doesnt break stuff lmao)
		// 	if (channelInDB && channelInDB.isEmbed === false && allChannel == message.channel.id) {
		// 		logger.info('false and channel equal message.channelid');
		// 		logger.info(allChannel.name);
		// 		await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
		// 	}
		// 	else if (channelInDB && allChannel == channelInDB.channelId && channelInDB.isEmbed === false) {
		// 		logger.info('both are false');
		// 		await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
		// 	}
		// 	else {
		// 		console.log('in elese');
		// 		await allChannel.send({ embeds: [embed] });
		// 	}
		// }


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

			// if (message.content.includes('https://') || message.content.includes('http://')) {
			// 	await message.channel.send('Haha good try, but the link you posted didn\'t get sent 😆.');
			// 	return;
			// }
			// fetching all channels from db
			const allConnectedChannels = await connectedList.find();

			const embed = new EmbedBuilder()
				.setTimestamp()
				.setColor(colors())
				.setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL({ dynamic: true }), url: `https://discord.com/users/${message.author.id}` })
				.setFooter({ text: `From: ${message.guild}┃${message.guild.id}`, iconURL: message.guild.iconURL({ dynamic: true }) })
				.addFields([
					{ name: 'Message', value: message.content || '\u200B', inline: false }]);

			// maybe do something similar for our rather 'big' messageTypes function?
			await require('../scripts/message/addBadges').execute(message, database, embed);
			await require('../scripts/message/messageContentModifiers').execute(message, embed);

			try {
				await message.delete();
			}
			catch (err) {
				logger.error(err);
			}

			const deletedChannels = [];

			/* for (let i = 0; i < allc.length; i++) {
				try {
					console.log('Trying...');
					// try to fetch all channels to see if they exist
					const channels = await client.channels.fetch(allc[i].channelId);
					console.log(channels.id);
				}
				catch (e) {
					console.log('Inside Catch');
					// if channels doesn't exist (thats probably why its in catch block in the first place (ʘ ͟ʖ ʘ))
					// push to deletedChannels array and delete later
					deletedChannels.push(allc[i].channelId);
					console.log(e);
					await connectedList.deleteMany({
						channelId: {
							$in: deletedChannels,
						},
					});
					// delete the channels that was pushed to the array earlier from the databse
					await setup.deleteMany({
						channelId: {
							$in: deletedChannels, // Note: $in only takes array
						},
					});
					console.log('channel id before:', allc[i].channelId);
					// replace this with something that doesnt iterate twise idk lmao [replace]
					sendInCatch(embed);
					return;
				}
				messageTypes(allc[i], embed);
			} */

			allConnectedChannels.forEach(async channelObj => {
				try {
					console.log('Trying...');
					// try to fetch all channels to see if they exist
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
					// delete the channels that was pushed to the array earlier from the databse
					await setup.deleteMany({
						channelId: {
							$in: deletedChannels, // Note: $in only takes array
						},
					});
					sendInCatch(connectedList, embed);
					// replace this with something that doesnt iterate twise idk lmao [replace]
					return;
				}
				await messageTypes(client, message, channelObj, embed, setup);

			});

			/*
			finally {
				console.log('Reached Finally');
				console.log('Deleted Channels: ', deletedChannels);
				await connectedList.deleteMany({
					channelId: {
						$in: deletedChannels,
					},
				});
				// console.log(channelObj.channelId);
				console.log('Under Finally');

				// const channel = await client.channels.fetch(channelObj.channelId);
				// channel.send({ embeds: [embed] });
			}

			console.log(searchCursor.length);
			try {
				console.log(channel.id);
				console.log(channelObj.channelId);
				const channel = await client.channels.fetch(channelObj.channelId);
			}
			catch (e) {
				return await connectedList.deleteOne({ 'channelId' : channelObj.channelId });
			}

			await channel.send({ embeds: [embed] });
			});
			const updatedList = await connectedList.find();
			const searchCursor = await connectedList.find().toArray();
			console.table(searchCursor);
			updatedList.forEach(async newObj => {
				console.log('New Obj: ', newObj);
				const channel = await client.channels.fetch(newObj.channelId);
				await channel.send({ embeds: [embed] });
			});
			*/
		}
		else {
			return;
		}
	},
};