import { ChatInputCommandInteraction, User } from 'discord.js';
import { getDb } from '../../Utils/misc/utils';

export default {
  async execute(
    interaction: ChatInputCommandInteraction,
    user: User,
    badge: string,
  ) {
    const db = getDb();
    const userInCollection = await db.userBadges.findFirst({ where: { userId: user.id } });

    if (userInCollection) {
      const userBadges = userInCollection.badges;

      if (userBadges.includes(badge)) {
        userBadges.splice(userBadges.indexOf(badge), 1);
        await db.userBadges.update({ where: { userId: user.id }, data: { badges: userBadges } });
        await interaction.reply(`Removed badge \`${badge}\` from user ${user.username}.`);
      }
      else {
        await interaction.reply(`User ${user.username} does not have the badge ${badge}.`);
      }
    }
    else {
      await interaction.reply(`User ${user.username} does not have the badge ${badge}.`);
    }
  },
};
