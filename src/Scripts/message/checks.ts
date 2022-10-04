import wordFilter from '../../Utils/functions/wordFilter';
import { Guild, Message } from 'discord.js';
import { Db } from 'mongodb';
import antiSpam from './antiSpam';

const usersMap = new Map();
const blacklistsMap = new Map();

export = {
	async execute(message: Message, database: Db | undefined) {
		// true = pass, false = fail (checks)

		// db for blacklisted users
		const blacklistedUsers = database?.collection('blacklistedUsers');
		const userInBlacklist = await blacklistedUsers?.findOne({ userId: message.author.id });


		if (userInBlacklist) {
			// if user is in blacklist and Notified is false, send them a message saying they are blacklisted
			if (!userInBlacklist.notified) {
				message.author.send(`You are blacklisted from using this bot for reason **${userInBlacklist.reason}**. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
				blacklistedUsers?.updateOne(
					{ userId: message.author.id },
					{ $set: { notified: true } },
				);
			}
			return false;
		}

		// FIXME: At the moment when a user is removed from blacklist,
		// ONE of the spam messages gets through. (as it is not in the map at that second)
		if (blacklistsMap.has(message.author.id)) return false;

		// db for blacklisted words
		const restrictedWords = database?.collection('restrictedWords');
		const wordList = await restrictedWords?.findOne({ name: 'blacklistedWords' });

		// check if message contains slurs
		if (
			message.content.toLowerCase().includes(wordList?.words[0]) ||
			message.content.toLowerCase().includes(wordList?.words[1]) ||
			message.content.toLowerCase().includes(wordList?.words[2])
		) {
			wordFilter.log(message.client, message.author, message.guild as Guild, message.content);
			return false;
		}

		// anti-spam check (basic but works well 🤷)
		const spam_filter = await antiSpam.execute(message, blacklistsMap, usersMap);
		if (spam_filter === true) return false;

		if (
			message.content.includes('discord.gg') ||
			message.content.includes('discord.com/invite') ||
			message.content.includes('dsc.gg')) {
			message.react(message.client.emoji.normal.no);
			return false;
		}

		// dont send message if guild name is inappropriate
		if (wordFilter.check(message.guild?.name)) {
			message.channel.send('I have detected words in the server name that are potentially offensive, Please fix them before using this chat!');
			return false;
		}
	},
};