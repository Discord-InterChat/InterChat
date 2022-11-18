import { PrismaClient } from '@prisma/client';
import { ChatInputCommandInteraction } from 'discord.js';
import logger from '../../Utils/logger';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, database: PrismaClient) {
		let userOpt = interaction.options.getString('user') as string;
		const reason = interaction.options.getString('reason', true);
		const subcommandGroup = interaction.options.getSubcommandGroup();

		const blacklistedUsers = database.blacklistedUsers;
		let user;

		try {
			userOpt = userOpt.replaceAll(/<@|!|>/g, '');

			user = interaction.client.users.cache.find(u => u.tag === userOpt);
			if (user === undefined) user = await interaction.client.users.fetch(userOpt);
		}
		catch { return interaction.reply('Could not find user. Use an ID instead.'); }

		const userInBlacklist = await blacklistedUsers.findFirst({ where: { userId: user.id } });

		if (subcommandGroup == 'add') {
			if (userInBlacklist) {
				interaction.reply(`${user.username}#${user.discriminator} is already blacklisted.`);
				return;
			}
			if (user.id === interaction.user.id) return interaction.reply('You cannot blacklist yourself.');
			if (user.id === interaction.client.user?.id) return interaction.reply('You cannot blacklist the bot wtf.');

			await blacklistedUsers.create({
				data: {
					username: `${user.username}#${user.discriminator}`,
					userId: user.id,
					reason,
					notified: true,
				},
			});

			try {
				await user.send({
					content: `You have been blacklisted from using this bot for reason **${reason}**. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`,
				});
			}
			catch {
				await blacklistedUsers.update({ where: { userId: user.id }, data: { notified: false } });
				logger.info(`Could not notify ${user.username}#${user.discriminator} about their blacklist.`);
			}

			interaction.reply(`**${user.username}#${user.discriminator}** has been blacklisted.`);
		}
		else if (subcommandGroup == 'remove') {
			if (!userInBlacklist) return interaction.reply(`The user ${user} is not blacklisted.`);

			await blacklistedUsers.delete({ where: { userId: user.id } });
			interaction.reply(`**${user.username}#${user.discriminator}** has been removed from the blacklist.`);
		}
	},
};
