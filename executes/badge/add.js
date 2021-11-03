module.exports = {
	async execute(interaction, dbCollection, user, badge) {
		const userInCollection = await dbCollection.findOne({ user_id: user.id });

		if (userInCollection) {
			const userBadges = userInCollection.badges;

			if (userBadges.includes(badge)) {
				await interaction.reply('User already has the badge.');
				return;
			}
			else {
				await dbCollection.updateOne({ user_id: user.id }, { $set: { badges: [...userBadges, badge] } });
				await interaction.reply(`Badge \`${badge}\` added to ${user.tag}.`);
				return;
			}
		}
		else {
			await dbCollection.insertOne({ user_id: user.id, badges: [badge] });
			await interaction.reply(`Badge \`${badge}\` added to ${user.tag}.`);
			return;
		}
	},
};