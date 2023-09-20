import { PrismaClient } from '@prisma/client';
import { EmbedBuilder, Message } from 'discord.js';
import { badgeToEmoji } from '../../Utils/misc/utils';

export default {
  async execute(message: Message, database: PrismaClient, embed: EmbedBuilder, censoredEmbed: EmbedBuilder) {
    const badges = await database.userBadges.findFirst({ where: { userId: message.author.id } });

    if (badges && badges.badges.length > 0) {
      const badgeString = badgeToEmoji(badges.badges).join(' ');

      embed.setTitle(badgeString);
      censoredEmbed.setTitle(badgeString);
    }
  },
};
