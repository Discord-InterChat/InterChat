import { PrismaClient } from '@prisma/client';
import { EmbedBuilder, Message } from 'discord.js';
import { badgeToEmoji } from '../../Utils/functions/utils';

export = {
  async execute(message: Message, database: PrismaClient, embed: EmbedBuilder, censoredEmbed: EmbedBuilder) {
    const badges = await database.userBadges.findFirst({ where: { userId: message.author.id } });

    if (badges && badges.badges.length > 0) {
      const badgeString = badgeToEmoji(badges.badges);

      embed.setTitle(badgeString);
      censoredEmbed.setTitle(badgeString);
    }
  },
};
