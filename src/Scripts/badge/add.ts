import { ChatInputCommandInteraction, User } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

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
        await interaction.reply('User already has the badge.');
        return;
      }
      else {
        await db.userBadges.update({ where: { userId: user.id }, data: { badges: [...userBadges, badge] } });
        await interaction.reply(`Badge \`${badge}\` added to ${user.username}.`);
        return;
      }
    }
    else {
      await db.userBadges.create({ data: { userId: user.id, badges: [badge] } });
      await interaction.reply(`Badge \`${badge}\` added to ${user.username}.`);
      return;
    }
  },
};
