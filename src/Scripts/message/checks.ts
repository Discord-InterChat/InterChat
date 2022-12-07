import wordFilter from '../../Utils/functions/wordFilter';
import { Message } from 'discord.js';
import { slurs } from '../../Utils/JSON/badwords.json';
import { PrismaClient } from '@prisma/client';

export = {
	async execute(message: Message, database: PrismaClient) {
		// true = pass, false = fail (checks)

		const userInBlacklist = await database.blacklistedUsers?.findFirst({ where: { userId: message.author.id } });
		const serverInBlacklist = await database.blacklistedServers?.findFirst({ where: { serverId: message.guild?.id } });

		if (serverInBlacklist) return false;
		if (userInBlacklist) {
			// if user is in blacklist and Notified is false, send them a message saying they are blacklisted
			if (!userInBlacklist.notified) {
				await database.blacklistedUsers.update({
					where: { userId: message.author.id },
					data: { notified: true },
				});
				message.author.send(`You are blacklisted from using this bot for reason **${userInBlacklist.reason}**. Please join the support server and contact the staff if you think the reason is not valid.`);
			}

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