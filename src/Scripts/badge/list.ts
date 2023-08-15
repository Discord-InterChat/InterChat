import { Prisma } from '@prisma/client';
import { ChatInputCommandInteraction, User } from 'discord.js';

export = {
  async execute(
    interaction: ChatInputCommandInteraction,
    dbCollection: Prisma.userBadgesDelegate<Prisma.RejectOnNotFound | Prisma.RejectPerOperation | undefined>,
    user: User,
  ) {
    const userInCollection = await dbCollection.findFirst({ where: { userId: user.id } });
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
