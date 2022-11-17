import { Prisma } from '@prisma/client';
import { ChatInputCommandInteraction, User } from 'discord.js';

module.exports = {
	async execute(
		interaction: ChatInputCommandInteraction,
		dbCollection: Prisma.userBadgesDelegate<Prisma.RejectOnNotFound | Prisma.RejectPerOperation | undefined>,
		user: User,
		badge: string,
	) {
		const userInCollection = await dbCollection.findFirst({ where: { userId: user.id } });

		if (userInCollection) {
			const userBadges = userInCollection.badges;

			if (userBadges.includes(badge)) {
				await interaction.reply('User already has the badge.');
				return;
			}
			else {
				await dbCollection.update({ where: { userId: user.id }, data: { badges: [...userBadges, badge] } });
				await interaction.reply(`Badge \`${badge}\` added to ${user.tag}.`);
				return;
			}
		}
		else {
			await dbCollection.create({ data: { userId: user.id, badges: [badge] } });
			await interaction.reply(`Badge \`${badge}\` added to ${user.tag}.`);
			return;
		}
	},
};