import wordFilter from '../../Utils/functions/wordFilter';
import { Message } from 'discord.js';
import { Db } from 'mongodb';
import { slurs } from '../../Utils/JSON/badwords.json';

export = {
	async execute(message: Message, database: Db) {
		// true = pass, false = fail (checks)

		const blacklistedUsers = database.collection('blacklistedUsers');
		const blacklistedServers = database.collection('blacklistedServers');
		const userInBlacklist = await blacklistedUsers?.findOne({ userId: message.author.id });
		const serverInBlacklist = await blacklistedServers?.findOne({ serverId: message.guildId });

		if (serverInBlacklist) return false;
		if (userInBlacklist) {
			// if user is in blacklist and Notified is false, send them a message saying they are blacklisted
			if (!userInBlacklist.notified) {
				blacklistedUsers?.updateOne(
					{ userId: message.author.id },
					{ $set: { notified: true } },
				);
			}
			message.author.send(`You are blacklisted from using this bot for reason **${userInBlacklist.reason}**. Please join the support server and contact the staff if you think the reason is not valid.`);
			return false;
		}

		// check if message contains slurs
		if (slurs.some((slur) => message.content.toLowerCase().includes(slur))) {
			wordFilter.log(message.client, message.author, message.guild, message.content);
			return false;
		}

		if (
			message.content.includes('discord.gg') ||
			message.content.includes('discord.com/invite') ||
			message.content.includes('dsc.gg')) {
			message.react(message.client.emoji.normal.no);
			return false;
		}

		// dont send message if guild name is inappropriate
		if (wordFilter.check(message.guild?.name)) {
			message.channel.send('I have detected words in the server name that are potentially offensive, Please fix it before using this chat!');
			return false;
		}

		if (wordFilter.check(message.content)) wordFilter.log(message.client, message.author, message.guild, message.content);

		return true;
	},
};