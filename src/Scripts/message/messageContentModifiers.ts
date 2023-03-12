import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { NetworkMessage } from '../../Events/messageCreate';
import { messageData } from '@prisma/client';
import { getDb } from '../../Utils/functions/utils';
import 'dotenv/config';

export default {
  async appendReply(message: NetworkMessage) {
    const db = getDb();
    let messageInDb: messageData | null | undefined = null;

    if (message.reference) {
      const referredMessage = await message.fetchReference().catch(() => null);

      if (referredMessage) {
        messageInDb = await db.messageData.findFirst({
          where: {
            channelAndMessageIds: {
              some: { messageId: referredMessage.id },
            },
          },
        });

        // content of the message being replied to
        let replyContent = referredMessage.embeds[0]?.fields[0]?.value || referredMessage.content;

        // if the message is a reply to another reply, remove the older reply :D
        if (messageInDb?.reference) {
          replyContent = replyContent?.split(/> .*/g).at(-1)?.trimStart() || replyContent;
        }

        replyContent = replyContent?.replaceAll('\n', '\n> ');

        const maxLength = 1000; // max length of an embed field (minus 24 just to be safe)
        const prefixLength = 6; // length of "> ", "\n" and "..."
        const availableLength = maxLength - prefixLength - message.content.length;

        // if it is too long, cut it off to make room for the reply
        if (replyContent.length > availableLength) {
          replyContent = replyContent.slice(0, availableLength) + '...';
        }

        message.content = `> ${replyContent}\n${message.content}`;
        message.compact_message = `> ${replyContent}\n${message.compact_message}`;
      }
    }
    return messageInDb;
  },

  async attachImageToEmbed(message: NetworkMessage, embed: EmbedBuilder, censoredEmbed: EmbedBuilder) {
    // Tenor Gifs / Image URLs
    const imageURLRegex = /(?:(?:(?:[A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)(?:(?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)(?:\.jpg|\.jpeg|\.gif|\.png|\.webp)/;
    const URLMatch = message.content.match(imageURLRegex);

    if (URLMatch) {
      embed
        .setImage(URLMatch[0])
        .setFields({ name: 'Message', value: message.content.replace(URLMatch[0], '\u200B').trim() });
      censoredEmbed
        .setImage(URLMatch[0])
        .setFields({ name: 'Message', value: message.censored_content.replace(URLMatch[0], '\u200B').trim() });
    }

    const tenorRegex = /https:\/\/tenor\.com\/view\/.*-(\d+)/;
    const gifMatch = message.content.match(tenorRegex);

    if (gifMatch) {
      const n = gifMatch[0].split('-');
      const id = n.at(-1);
      const api = `https://g.tenor.com/v1/gifs?ids=${id}&key=${process.env.TENOR_KEY}`;
      const gifJSON = await (await fetch(api)).json();

      embed
        .setImage(gifJSON.results[0].media[0].gif.url)
        .setFields({ name: 'Message', value: message.content.replace(gifMatch[0], '\u200B').trim() });
      censoredEmbed
        .setImage(gifJSON.results[0].media[0].gif.url)
        .setFields({ name: 'Message', value: message.censored_content.replace(gifMatch[0], '\u200B').trim() });
    }

    // Attached Images (uploaded without url)
    const attachment = message.attachments.first();
    if (attachment) {
      if (message.attachments.size > 1) message.reply('Due to Discord\'s Embed limitations, only the first attachment will be sent.');

      const newAttachment = new AttachmentBuilder(`${attachment.url}`, { name: `${attachment.name}` });
      embed.setImage(`attachment://${newAttachment.name}`);
      censoredEmbed.setImage(`attachment://${newAttachment.name}`);
      return newAttachment; // return the new attachment buffer so we can send in the network
    }
  },
};
