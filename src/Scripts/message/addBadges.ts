import { EmbedBuilder, Message } from 'discord.js';
import { Db } from 'mongodb';

export = {
	async execute(message: Message, database: Db, embed: EmbedBuilder) {
		const emoji = message.client.emoji;
		const badges = await database.collection('userBadges').findOne({ userId: message.author.id });

		if (!badges) return;

		if (badges.badges.length > 0) {
			let badgeString = '';
			for (const badge of badges.badges) {
				if (badge === 'Developer') {
					badgeString += emoji.badge.developer + '\u200B ';
				}
				else if (badge === 'Staff') {
					badgeString += emoji.badge.staff + '\u200B ';
				}
				else if (badge === 'Voter') {
					badgeString += emoji.badge.premium + '\u200B ';
				}
			}
			embed.setTitle(badgeString.slice(0, -1));
		}
	},
};