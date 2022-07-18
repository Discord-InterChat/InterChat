module.exports = {
	/**
	 * @param {import('discord.js').ChatInputCommandInteraction} interaction
	 * @param {import('mongodb').Collection} dbCollection
	 * @param {import('discord.js').User} user
	 * @param {*} badge
	 * @returns
	 */
	async execute(interaction, dbCollection, user, badge) {
		const userInCollection = await dbCollection.findOne({ userId: user.id });

		if (userInCollection) {
			const userBadges = userInCollection.badges;

			if (userBadges.includes(badge)) {
				await interaction.reply('User already has the badge.');
				return;
			}
			else {
				await dbCollection.updateOne({ userId: user.id }, { $set: { badges: [...userBadges, badge] } });
				await interaction.reply(`Badge \`${badge}\` added to ${user.tag}.`);
				return;
			}
		}
		else {
			await dbCollection.insertOne({ userId: user.id, badges: [badge] });
			await interaction.reply(`Badge \`${badge}\` added to ${user.tag}.`);
			return;
		}
	},
};