import wordFilter from '../../Utils/functions/wordFilter';
import antiSpam from './antispam';
import { Message } from 'discord.js';
import { slurs } from '../../Utils/JSON/badwords.json';
import { addUserBlacklist, getDb } from '../../Utils/functions/utils';
import { connectedList } from '@prisma/client';

export = {
  async execute(message: Message, networkData: connectedList) {
    // true = pass, false = fail (checks)

    if (!networkData.hubId) {
      message.reply('Using InterChat without a joining hub is no longer supported. Join a hub by using `/hub join` and explore hubs using `/hub browse`.');
      return false;
    }

    const db = getDb();
    const userInBlacklist = await db.blacklistedUsers?.findFirst({
      where: { hubId: networkData.hubId, userId: message.author.id },
    });
    const serverInBlacklist = await db.blacklistedServers?.findFirst({
      where: { hubId: networkData.hubId, serverId: message.guild?.id },
    });

    if (userInBlacklist) {
      if (!userInBlacklist.notified) {
        message.author.send(`You are blacklisted from this hub for reason **${userInBlacklist.reason}**.`).catch(() => null);
        await db.blacklistedUsers.update({ where: { userId: message.author.id }, data: { notified: true } });
      }
      return false;
    }
    if (serverInBlacklist) return false;

    const antiSpamResult = antiSpam(message.author, 3);
    if (antiSpamResult) {
      if (antiSpamResult.infractions >= 3) {
        addUserBlacklist(networkData.hubId, message.client.user, message.author, 'Auto-blacklisted for spamming.', 60 * 5000);
      }
      message.react(message.client.emotes.icons.timeout);
      return false;
    }
    if (message.content.length > 1000) {
      message.reply('Please keep your message shorter than 1000 characters long.');
      return false;
    }

    // check if message contains slurs
    if (slurs.some((slur) => message.content.toLowerCase().includes(slur))) {
      wordFilter.log(message.content, message.author, message.guildId, networkData.hubId);
      return false;
    }

    if (
      message.content.includes('discord.gg') ||
      message.content.includes('discord.com/invite') ||
      message.content.includes('dsc.gg')
    ) {
      message.reply('Do not advertise or promote servers in the network. Set an invite in `/network manage` instead!');
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

    if (wordFilter.check(message.content)) wordFilter.log(message.content, message.author, message.guildId, networkData.hubId);

    return true;
  },
};
