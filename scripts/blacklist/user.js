const logger = require('../../logger');

module.exports = {
	async execute(interaction, database) {
		const userOpt = interaction.options.getString('user');
		const reason = interaction.options.getString('reason');
		const subcommandGroup = interaction.options.getSubcommandGroup();

		const blacklistedUsers = database.collection('blacklistedUsers');
		const userInBlacklist = await blacklistedUsers.findOne({ userId: userOpt });
		let user;
		try {
			user = await interaction.client.users.fetch(userOpt);
		}
		catch {
			interaction.reply('Something went wrong! Are you sure that was a valid user ID?');
			return;
		}

		if (subcommandGroup == 'add') {
			if (userInBlacklist) {
				interaction.reply(`${user.username}#${user.discriminator} is already blacklisted.`);
				return;
			}
			if (userOpt == interaction.user.id) return interaction.reply('You cannot blacklist yourself.');
			if (userOpt == interaction.client.user.id) return interaction.reply('You cannot blacklist the bot wtf.');

			await blacklistedUsers.insertOne({
				username: `${user.username}#${user.discriminator}`,
				userId: userOpt,
				reason: reason,
				notified: true,
			});

			try {
				await user.send(`You have been blacklisted from using this bot for reason **${reason}**. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
			}
			catch {
				await blacklistedUsers.updateOne({ userId: userOpt }, { $set: { notified: false } });
				logger.info(`Could not notify ${user.username}#${user.discriminator} about blacklist.`);
			}

			interaction.reply(`**${user.username}#${user.discriminator}** has been blacklisted.`);
		}
		else if (subcommandGroup == 'remove') {
			if (!userInBlacklist) {
				interaction.reply(`The user ${user} is not blacklisted.`);
				return;
			}

			await blacklistedUsers.deleteOne({ userId: userOpt });
			interaction.reply(`**${user.username}#${user.discriminator}** has been removed from the blacklist.`);
		}
	},
};