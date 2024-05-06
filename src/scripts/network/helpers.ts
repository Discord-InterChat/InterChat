import { Message, HexColorString, EmbedBuilder } from 'discord.js';
import { REGEX } from '../../utils/Constants.js';
import { censor } from '../../utils/Profanity.js';

/**
 * Retrieves the content of a referred message, which can be either the message's text content or the description of its first embed.
 * If the referred message has no content, returns a default message indicating that the original message contains an attachment.
 * If the referred message's content exceeds 1000 characters, truncates it and appends an ellipsis.
 * @param referredMessage The message being referred to.
 * @returns The content of the referred message.
 */
export const getReferredContent = (referredMessage: Message) => {
  let referredContent = referredMessage.content || referredMessage.embeds[0]?.description;

  if (!referredContent) {
    referredContent = '*Original message contains attachment <:attachment:1102464803647275028>*';
  }
  else if (referredContent.length > 100) {
    referredContent = referredContent.slice(0, 100) + '...';
  }

  return referredContent;
};

/**
 * Builds an embed for a network message.
 * @param message The network message to build the embed for.
 * @param opts Optional parameters for the embed.
 * @param opts.attachmentURL The URL of the attachment to include in the embed.
 * @param opts.embedCol The color of the embed.
 * @param opts.referredContent The content of the message being replied to.
 * @param opts.useNicknames Whether to use nicknames instead of usernames in the embed.
 * @returns An object containing the built EmbedBuilder and its censored version.
 */
export const buildNetworkEmbed = (
  message: Message,
  username: string,
  censoredContent: string,
  opts?: {
    attachmentURL?: string | null;
    embedCol?: HexColorString;
    referredContent?: string;
  },
) => {
  const formattedReply = opts?.referredContent?.replaceAll('\n', '\n> ');

  const embed = new EmbedBuilder()
    .setAuthor({
      name: username,
      iconURL: message.author.displayAvatarURL(),
    })
    .setDescription(
      // remove tenor links and image urls from the content
      (opts?.attachmentURL
        ? message.content.replace(REGEX.TENOR_LINKS, '').replace(opts?.attachmentURL, '')
        : message.content) || null,
    )
    .addFields(formattedReply ? [{ name: 'Replying To:', value: `> ${formattedReply}` }] : [])
    .setFooter({
      text: `From: ${message.guild?.name}`,
      iconURL: message.guild?.iconURL() ?? undefined,
    })
    .setImage(opts?.attachmentURL ?? null)
    .setColor(opts?.embedCol ?? 'Random');

  const censoredEmbed = EmbedBuilder.from(embed)
    .setDescription(
      // remove tenor links and image urls from the content
      (opts?.attachmentURL
        ? censoredContent.replace(REGEX.TENOR_LINKS, '').replace(opts?.attachmentURL, '')
        : censoredContent) || null,
    )
    .setFields(
      formattedReply ? [{ name: 'Replying To:', value: `> ${censor(formattedReply)}` }] : [],
    );

  return { embed, censoredEmbed };
};
