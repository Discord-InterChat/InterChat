module.exports = {
	async execute(interaction, dbCollection, user) {
		const userInCollection = await dbCollection.findOne({ user_id: user.id });
		if (!userInCollection) {
			await interaction.reply(`User ${user.tag} doesn't have any badges!`);
		}
		else {
			const badges = userInCollection.badges;
			if (badges.length === 0) {
				await interaction.reply(`User ${user.tag} doesn't have any badges!`);
			}
			else {
				const badgeList = badges.map(badge => `\`${badge}\``);
				await interaction.reply(`User ${user.tag} has the badges ${badgeList.join(', ')}.`);
			}
		}
	},
};