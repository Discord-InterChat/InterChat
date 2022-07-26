const antiSpam = require('./antiSpam');
const wordFilter = require('./wordFilter');
const emoji = require('../../emoji.json');
const Filter = require('bad-words'),
	filter = new Filter();

module.exports = {
	async execute(message, database) {

		// db for blacklisted users
		const blacklistedUsers = database.collection('blacklistedUsers');
		const userInBlacklist = await blacklistedUsers.findOne({
			userId: message.author.id,
		});

		// db for blacklisted words
		const restrictedWords = database.collection('restrictedWords');
		const wordList = await restrictedWords.findOne({
			name: 'blacklistedWords',
		});

		antiSpam.execute(message);


		if (userInBlacklist) {
			// if user is in blacklist and Notified is false, send them a message saying they are blacklisted
			if (!userInBlacklist.notified) {
				await message.author.send(
					`You are blacklisted from using this bot for reason **${userInBlacklist.reason}**. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`,
				);
				blacklistedUsers.updateOne(
					{ userId: message.author.id },
					{ $set: { notified: true } },
				);
			}
			return false;
		}

		if (message.content.includes('discord.gg') || message.content.includes('discord.com/invite')) {
			message.react(emoji.normal.no);
			return false;
		}

		// check if message contains slurs
		if (
			message.content.toLowerCase().includes(wordList.words[0]) ||
			message.content.toLowerCase().includes(wordList.words[1]) ||
			message.content.toLowerCase().includes(wordList.words[2])
		) {
			await wordFilter.log(message, '1000730718474875020');
			return false;
		}
		// dont send message if guild name is inappropriate
		if (filter.isProfane(message.guild.name)) {
			message.channel.send(
				'I have detected words in the server name that are potentially offensive, Please fix them before using this chat!',
			);
			return false;
		}
	},
};