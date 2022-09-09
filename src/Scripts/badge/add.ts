import { ChatInputCommandInteraction, User } from 'discord.js';
import { Collection } from 'mongodb';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction, dbCollection: Collection, user: User, badge: string) {
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