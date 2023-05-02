import wordFilter from '../../Utils/functions/wordFilter';
import antiSpam from './antispam';
import { Message } from 'discord.js';
import { slurs } from '../../Utils/JSON/badwords.json';
import { PrismaClient } from '@prisma/client';

export = {
  async execute(message: Message, database: PrismaClient) {
    // true = pass, false = fail (checks)

    const userInBlacklist = await database.blacklistedUsers?.findFirst({
      where: { userId: message.author.id },
    });
    const serverInBlacklist = await database.blacklistedServers?.findFirst({
      where: { serverId: message.guild?.id },
    });

    if (userInBlacklist) {
      if (!userInBlacklist.notified) {
        message.author.send(`You are blacklisted from using this bot for reason **${userInBlacklist.reason}**.`).catch(() => null);
        await database.blacklistedUsers.update({ where: { userId: message.author.id }, data: { notified: true } });
      }
      return false;
    }
    if (serverInBlacklist) return false;

    if (antiSpam(message.author)) {
      message.react(message.client.emotes.icons.timeout);
      return false;
    }
    if (message.content.length > 1000) {
      message.reply('Please keep your message shorter than 1000 characters long.');
      return false;
    }

    // check if message contains slurs
    if (slurs.some((slur) => message.content.toLowerCase().includes(slur))) {
      wordFilter.log(message.client, message.author, message.guild, message.content);
      return false;
    }

    if (
      message.content.includes('discord.gg') ||
      message.content.includes('discord.com/invite') ||
      message.content.includes('dsc.gg')
    ) {
      message.reply('Do not advertise or promote servers in the network. Set an invite in `/setup edit` instead!');
      return false;
    }

    // dont send message if guild name is inappropriate
    if (wordFilter.check(message.guild?.name)) {
      message.channel.send('I have detected words in the server name that are potentially offensive, Please fix it before using this chat!');
      return false;
    }

    if (message.stickers.size > 0 && !message.content) {
      message.reply('Sending stickers in the network is not possible due to discord\'s limitations.');
      return false;
    }

    // TODO allow multiple attachments when embeds can have multiple images
    const attachment = message.attachments.first();
    const allowedTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

    if (attachment?.contentType && !allowedTypes.includes(attachment.contentType)) {
      message.reply('Only images and gifs are allowed to be sent within the network.');
      return false;
    }

    if (attachment && attachment.size > 1024 * 1024 * 8) {
      message.reply('Please keep your attachments under 8MB.');
      return false;
    }

    if (wordFilter.check(message.content)) wordFilter.log(message.client, message.author, message.guild, message.content);

    return true;
  },
};
