import { PrismaClient } from '@prisma/client';
import { EmbedBuilder, Message } from 'discord.js';

export = {
  async execute(message: Message, database: PrismaClient, embed: EmbedBuilder, censoredEmbed: EmbedBuilder) {
    const emoji = message.client.emoji;
    let badges = await database.userBadges.findFirst({ where: { userId: message.author.id } });


    const christmasEmbed = new EmbedBuilder()
      .setTitle('Merry ChatBotmas!')
      .setDescription('\'Tis the season of joy and cheer, and we at ChatBot are delighted to present you with a limited-time Christmas badge. Thank you for choosing ChatBot, and we wish you a Merry Christmas and a happy holiday season! 🎅')
      .setImage('https://media.tenor.com/SF-pc-SCoVkAAAAi/merry-christmas.gif')
      .setColor('#064e00');

    if (!badges) {
      badges = await database.userBadges.create({
        data: { userId: message.author.id, badges: ['Christmas2022'] },
      });
      message.author.send({ embeds: [christmasEmbed] }).catch(() => null);
    }
    else if (!badges.badges.includes('Christmas2022')) {
      badges = await database.userBadges.update({
        where:{ userId: message.author.id },
        data: { badges: [...badges.badges, 'Christmas2022'] },
      });
      message.author.send({ embeds: [christmasEmbed] }).catch(() => null);
    }

    if (badges && badges.badges.length > 0) {
      let badgeString = '';
      for (const badge of badges.badges) {
        if (badge === 'Developer') {
          badgeString += emoji.badge.developer + '\u200B ';
        }
        else if (badge === 'Staff') {
          badgeString += emoji.badge.staff + '\u200B ';
        }
        else if (badge === 'Voter') {
          badgeString += emoji.badge.premium + '\u200B ';
        }
        else if (badge === 'Christmas2022') {
          badgeString += emoji.badge.christmas_2022 + '\u200B ';
        }
      }
      embed.setTitle(badgeString.slice(0, -1));
      censoredEmbed.setTitle(badgeString.slice(0, -1));
    }
  },
};
