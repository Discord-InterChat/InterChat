module.exports = {
	async execute(interaction, database) {
		const userOpt = interaction.options.getString('user');
		const reason = interaction.options.getString('reason');
		const subcommandGroup = interaction.options.getSubcommandGroup();

		const blacklistedUsers = database.collection('blacklistedUsers');
		const userInBlacklist = await blacklistedUsers.findOne({ userId: userOpt });

		const user = await interaction.client.users.fetch(userOpt);

		if (subcommandGroup == 'add') {
			if (userInBlacklist) {
				interaction.reply(`${user} is already blacklisted.`);
				return;
			}

			await blacklistedUsers.insertOne({
				userId: userOpt,
				reason: reason,
			});

			interaction.reply(`${userOpt} has been blacklisted.`);
		}
		else if (subcommandGroup == 'remove') {
			if (!userInBlacklist) {
				interaction.reply(`The user ${user} is not blacklisted.`);
				return;
			}

			await blacklistedUsers.deleteOne({ userId: userOpt });

			interaction.reply(`${user} has been removed from the blacklist.`);
		}
	},
};