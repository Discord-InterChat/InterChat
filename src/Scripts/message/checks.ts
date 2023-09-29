import wordFilter from '../../Utils/wordFilter';
import antiSpam from './antispam';
import emojis from '../../Utils/JSON/emoji.json';
import { Message } from 'discord.js';
import { slurs } from '../../Utils/JSON/badwords.json';
import { replaceLinks } from '../../Utils/utils';
import { connectedList } from '@prisma/client';
import { HubSettingsBitField } from '../../Utils/hubSettingsBitfield';
import { addUserBlacklist, findBlacklistedServer, findBlacklistedUser, notifyBlacklist, scheduleUnblacklist } from '../../Utils/blacklist';
export default {
  async execute(message: Message, networkData: connectedList, settings: HubSettingsBitField) {
    // true = pass, false = fail (checks)

    const userBlacklisted = await findBlacklistedUser(networkData.hubId, message.author.id);
    const serverBlacklisted = await findBlacklistedServer(networkData.hubId, message.guildId || '');
    if (userBlacklisted || serverBlacklisted) return false;

    if (settings.has('SpamFilter')) {
      const antiSpamResult = antiSpam.execute(message.author, 3);
      if (antiSpamResult) {
        if (antiSpamResult.infractions >= 3) {
          await addUserBlacklist(networkData.hubId, message.client.user, message.author, 'Auto-blacklisted for spamming.', 60 * 5000);
          scheduleUnblacklist('user', message.client, message.author.id, networkData.hubId, 60 * 5000);

          notifyBlacklist(message.author, networkData.hubId, new Date(Date.now() + 60 * 5000), 'Auto-blacklisted for spamming.').catch(() => null);
        }
        message.react(emojis.icons.timeout).catch(() => null);
        return false;
      }

      if (message.content.length > 1000) {
        message.reply('Please keep your message shorter than 1000 characters long.');
        return false;
      }
    }

    // check if message contains slurs
    if (slurs.some((slur) => message.content.toLowerCase().includes(slur))) {
      wordFilter.log(message.content, message.author, message.guildId, networkData.hubId);
      return false;
    }

    if (
      settings.has('BlockInvites') &&
      message.content.includes('discord.gg') ||
      message.content.includes('discord.com/invite') ||
      message.content.includes('dsc.gg')
    ) {
      message.reply('Do not advertise or promote servers in the network. Set an invite in `/network manage` instead!');
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

    // dont send message if guild name is inappropriate
    if (wordFilter.check(message.guild?.name)) {
      message.channel.send('I have detected words in the server name that are potentially offensive, Please fix it before using this chat!');
      return false;
    }

    if (wordFilter.check(message.content)) wordFilter.log(message.content, message.author, message.guildId, networkData.hubId);

    const urlRegex = /https?:\/\/(?!tenor\.com|giphy\.com)\S+/g;
    if (settings.has('HideLinks') && message.content.match(urlRegex)) {
      message.content = replaceLinks(message.content);
    }

    return true;
  },
};
