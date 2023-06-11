import { AttachmentBuilder, Message } from 'discord.js';
import { NetworkMessage } from '../../Events/messageCreate';
import 'dotenv/config';

export default {
  getReferredContent(message: Message, referredMessage: Message) {
    let referredContent = referredMessage.content || referredMessage.embeds[0]?.description;

    if (!referredContent || referredContent === '\u200B') {
      referredContent += '*Original message contains attachment <:attachment:1102464803647275028>*';
    }
    else if (referredContent.length > 1000) {referredContent = referredContent.slice(0, 1000) + '...';}

    return referredContent;
  },

  getAttachment(message: NetworkMessage) {
    // Attached Images (uploaded without url)
    const attachment = message.attachments.first();
    if (attachment) {
      if (message.attachments.size > 1) message.reply('Due to Discord\'s Embed limitations, only the first attachment will be sent.');

      const newAttachment = new AttachmentBuilder(`${attachment.url}`, { name: `${attachment.name}` });
      return newAttachment; // return the new attachment buffer so we can send in the network
    }
  },
  async getAttachmentURL(message: NetworkMessage) {
    // Tenor Gifs / Image URLs
    const imageURLRegex = /(?:(?:(?:[A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)(?:(?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)(?:\.jpg|\.jpeg|\.gif|\.png|\.webp)/;
    const URLMatch = message.content.match(imageURLRegex);

    if (URLMatch) return URLMatch[0];

    const tenorRegex = /https:\/\/tenor\.com\/view\/.*-(\d+)/;
    const gifMatch = message.content.match(tenorRegex);

    if (gifMatch) {
      const n = gifMatch[0].split('-');
      const id = n.at(-1);
      const api = `https://g.tenor.com/v1/gifs?ids=${id}&key=${process.env.TENOR_KEY}`;
      const gifJSON = await (await fetch(api)).json();

      return gifJSON.results[0].media[0].gif.url as string;
    }
  },
};
