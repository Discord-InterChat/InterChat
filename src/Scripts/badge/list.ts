import { ChatInputCommandInteraction, User } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export default {
  async execute(
    interaction: ChatInputCommandInteraction,
    user: User,
  ) {
    const db = getDb();
    const userInCollection = await db.userBadges.findFirst({ where: { userId: user.id } });
    if (!userInCollection) {
      await interaction.reply(`User ${user.username} doesn't have any badges!`);
    }
    else {
      const badges = userInCollection.badges;
      if (badges.length === 0) {
        await interaction.reply(`User ${user.username} doesn't have any badges!`);
      }
      else {
        const badgeList = badges.map((badge: string) => `\`${badge}\``);
        await interaction.reply(`User ${user.username} has the badges ${badgeList.join(', ')}.`);
      }
    }
  },
};
