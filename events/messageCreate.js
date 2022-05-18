const { EmbedBuilder } = require('discord.js');
const logger = require('../logger');
const mongoUtil = require('../utils');
const { colors } = require('../utils');
const { client } = require('../index');

module.exports = {
	name: 'messageCreate',
	async execute(message) {
		if (message.author.bot) return;

		if (message.content.startsWith('c!help') || message.content.startsWith('c!connect') || message.content.startsWith('c!disconnect')) {
			await message.reply('ChatBot does not respond to any commands with the prefix `c!` anymore since we have switched to slash commands! Please type / and check out the list of commands!');
			return;
		}

		const database = mongoUtil.getDb();
		const connectedList = database.collection('connectedList');

		const setup = database.collection('setup');

		const guildInDB = await setup.findOne({ 'guildId': message.guild.id });
		const channelInNetwork = await connectedList.findOne({ channelId: message.channel.id });

		async function sendInCatch(embed) {
			const newConnectedChannels = await connectedList.find({});
			newConnectedChannels.forEach(async element => {
				console.log('ChannelId:', element.channelId);
				const allChannel = await client.channels.fetch(element.channelId);
				console.log(guildInDB.isEmbed);

				const channelInDb = await setup.findOne({ 'channelId': allChannel.id });

				if (guildInDB.isEmbed === null || channelInDb === null) {
					await allChannel.send({ embeds: [embed] });
				}
				// guildInDB.isEmbed returning null. Cause server is not setup, find a way to try-catch this too or smth
				else if (guildInDB.isEmbed === false && allChannel == message.channel.id) {
					console.log('FALSE AND CHANNEL == MESSAGE.CHANNELID');
					await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
				}
				else if (allChannel == channelInDb.channelId && channelInDb.isEmbed === false) {
					console.log(allChannel.id);
					console.log(guildInDB.channelId);
					await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
				}
				else {
					console.log('IN ELESE');
					await allChannel.send({ embeds: [embed] });
				}
			});
		}

		async function messageTypes(channelObj, embed) {
			const allChannel = await client.channels.fetch(channelObj.channelId);

			const channelInDb = await setup.findOne({ 'channelId': allChannel.id });

			if (guildInDB.isEmbed === null || channelInDb === null) {
				await allChannel.send({ embeds: [embed] });
			}
			else if (guildInDB.isEmbed === false && allChannel == message.channel.id) {
				console.log('FALSE AND CHANNEL == MESSAGE.CHANNELID');
				await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
			}
			else if (allChannel == channelInDb.channelId && channelInDb.isEmbed === false) {
				console.log(allChannel.id);
				console.log(guildInDB.channelId);
				await allChannel.send(({ content: `**${message.author.tag}:** ${message.content}` }));
			}
			else {
				console.log('IN ELESE');
				await allChannel.send({ embeds: [embed] });
			}
		}

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

			if (message.content.includes('https://') || message.content.includes('http://')) {
				await message.channel.send('Haha good try, but the link you posted didn\'t get sent 😆.');
				return;
			}

			const allConnectedChannels = await connectedList.find({});
			const embed = new EmbedBuilder()
				.setTimestamp()
				.setColor(colors())
				.setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL({ dynamic: true }), url: `https://discord.com/users/${message.author.id}` })
				.setFooter({ text: `From: ${message.guild}┃${message.guild.id}`, iconURL: message.guild.iconURL({ dynamic: true }) })
				.addFields([
					{ name: 'Message', value: message.content || '\u200B', inline: false }]);

			await require('../scripts/message/addBadges').execute(message, database, embed);
			await require('../scripts/message/messageContentModifiers').execute(message, embed);

			try {
				await message.delete();
			}
			catch (err) {
				logger.error(err);
			}

			const deletedChannels = [];
			// console.log(allConnectedChannels);
			allConnectedChannels.forEach(async channelObj => {
				// console.log(channelObj.channelId);
				try {
					console.log('Trying...');
					await client.channels.fetch(channelObj.channelId);
				}
				catch (e) {
					console.log('Inside Catch');
					deletedChannels.push(channelObj.channelId);
					console.log(e);
					await connectedList.deleteMany({
						channelId: {
							$in: deletedChannels,
						},
					});
					await setup.deleteMany({
						channelId: {
							$in: deletedChannels,
						},
					});
					console.log('channel id before:', channelObj.channelId);
					sendInCatch(embed);
					return;
				}
				messageTypes(channelObj, embed);

			});
			// eslint-disable-next-line no-inner-declarations

			// finally {
			// 	console.log('Reached Finally');
			// 	console.log('Deleted Channels: ', deletedChannels);
			// 	await connectedList.deleteMany({
			// 		channelId: {
			// 			$in: deletedChannels,
			// 		},
			// 	});
			// 	// console.log(channelObj.channelId);
			// 	console.log('Under Finally');

			// 	// const channel = await client.channels.fetch(channelObj.channelId);
			// 	// channel.send({ embeds: [embed] });
			// }

			// console.log(searchCursor.length);
			// try {
			// 	console.log(channel.id);
			// 	console.log(channelObj.channelId);
			// 	const channel = await client.channels.fetch(channelObj.channelId);
			// }
			// catch (e) {
			// 	return await connectedList.deleteOne({ 'channelId' : channelObj.channelId });
			// }

			// await channel.send({ embeds: [embed] });
			// });
			// const updatedList = await connectedList.find();
			// const searchCursor = await connectedList.find().toArray();
			// console.table(searchCursor);
			// updatedList.forEach(async newObj => {
			// 	console.log('New Obj: ', newObj);
			// 	const channel = await client.channels.fetch(newObj.channelId);
			// 	await channel.send({ embeds: [embed] });
			// });
		}
		else {
			return;
		}
	},
};