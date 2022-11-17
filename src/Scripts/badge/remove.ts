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
				userBadges.splice(userBadges.indexOf(badge), 1);
				dbCollection.update({ where: { userId: user.id }, data: { badges: userBadges } });
				await interaction.reply(`Removed badge \`${badge}\` from user ${user.tag}.`);
			}
			else {
				await interaction.reply(`User ${user.tag} does not have the badge ${badge}.`);
			}
		}
		else {
			await interaction.reply(`User ${user.tag} does not have the badge ${badge}.`);
		}
	},
};