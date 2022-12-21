import wordFilter from '../../Utils/functions/wordFilter';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { MessageInterface } from '../../Events/messageCreate';
import { messageData, PrismaClient } from '@prisma/client';
import 'dotenv/config';

export = {
  async execute(message: MessageInterface) {
    message.censored_content = wordFilter.censor(message.content);
    message.censored_compact_message = wordFilter.censor(message.compact_message);
  },

  async appendReply(message: MessageInterface, db: PrismaClient | null) {
    message.compact_message = `**${message.author.tag}:** ${message.content}`;

    let messageInDb: messageData | null | undefined = null;
    if (message.reference) {
      const referredMessage = await message.fetchReference().catch(() => null);

      if (referredMessage) {
        messageInDb = await db?.messageData.findFirst({
          where: {
            channelAndMessageIds: {
              some: { messageId: referredMessage.id },
            },
          },
        });

        let embed = referredMessage.embeds[0]?.fields[0]?.value;
        let compact = referredMessage.content;

        // if the message is a reply to another reply, remove the older reply :D
        if (messageInDb?.reference) {
          const replaceReply = (string: string) => {
            // if for some reason the reply got edited and the reply format (> message) is not there
            // return the original message and not undefined
            return string?.split(/> .*/g).at(-1)?.trimStart() || string;
          };

          // messages that are being replied to
          embed = replaceReply(embed);
          compact = replaceReply(compact);
        }

        embed = embed?.replaceAll('\n', '\n> ');
        compact = compact?.replaceAll('\n', '\n> ');

        message.content = `> ${embed || compact}\n${message.content}`;
        message.compact_message = `> ${embed || compact}\n${message.compact_message}`;
      }

    }
    return messageInDb;
  },

  async attachmentModifiers(message: MessageInterface, embed: EmbedBuilder, censoredEmbed: EmbedBuilder) {
    if (message.attachments.size > 1) {
      await message.reply('Due to Discord\'s Embed limitations, only the first attachment will be sent.');
    }

    const attachment = message.attachments.first();

    if (attachment?.contentType?.includes('mp4') === false) {
      const newAttachment = new AttachmentBuilder(`${attachment.url}`, { name: `${attachment.name}` });
      embed.setImage(`attachment://${newAttachment.name}`);
      censoredEmbed.setImage(`attachment://${newAttachment.name}`);
      return newAttachment;
    }


    const imageURLRegex = /(?:(?:(?:[A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)(?:(?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)(?:\.jpg|\.jpeg|\.gif|\.png|\.webp)/;
    const URLMatch = message.content.match(imageURLRegex);

    if (URLMatch) {
      embed
        .setImage(URLMatch[0])
        .setFields([{ name: 'Message', value: message.content.replace(URLMatch[0], '\u200B').trim() }]);
      censoredEmbed
        .setImage(URLMatch[0])
        .setFields([{ name: 'Message', value: message.censored_content.replace(URLMatch[0], '\u200B').trim() }]);
    }

    const tenorRegex = /https:\/\/tenor\.com\/view\/.*-(\d+)/;
    const gifMatch = message.content.match(tenorRegex);

    if (gifMatch) {
      const n = gifMatch[0].split('-');
      const id = n[n.length - 1];
      const api = `https://g.tenor.com/v1/gifs?ids=${id}&key=${process.env.TENOR_KEY}`;
      const gifJSON = (await (await fetch(api)).json());

      embed
        .setImage(gifJSON.results[0].media[0].gif.url)
        .setFields([{ name: 'Message', value: message.content.replace(gifMatch[0], '\u200B').trim() }]);
      censoredEmbed
        .setImage(gifJSON.results[0].media[0].gif.url)
        .setFields([{ name: 'Message', value: message.censored_content.replace(gifMatch[0], '\u200B').trim() }]);
    }

    else if (message.embeds[0]?.provider?.name === 'YouTube' && message.embeds[0]?.data.thumbnail) {
      embed.setImage(message.embeds[0].data.thumbnail.url);
      censoredEmbed.setImage(message.embeds[0].data.thumbnail.url);
    }
  },
};
