import {
  Message,
  HexColorString,
  EmbedBuilder,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
} from 'discord.js';
import db from '../../utils/Db.js';
import hub from '../../commands/slash/Main/hub/index.js';
import { LINKS, REGEX, emojis } from '../../utils/Constants.js';
import { censor } from '../../utils/Profanity.js';
import { broadcastedMessages } from '@prisma/client';
import { t } from '../../utils/Locale.js';

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

export const getReferredMsgData = async (referredMessage: Message | null) => {
  if (!referredMessage) return { dbReferrence: undefined, referredAuthor: undefined };

  const { client } = referredMessage;

  // check if it was sent in the network
  const dbReferrence = referredMessage
    ? (
      await db.broadcastedMessages.findFirst({
        where: { messageId: referredMessage?.id },
        include: { originalMsg: { include: { broadcastMsgs: true } } },
      })
    )?.originalMsg
    : undefined;

  if (!dbReferrence) return { dbReferrence: undefined, referredAuthor: undefined };

  const referredAuthor =
    referredMessage.author.id === client.user.id
      ? client.user
      : await client.users.fetch(dbReferrence.authorId).catch(() => undefined);

  return { dbReferrence, referredAuthor };
};

export const removeImgLinks = (content: string, imgUrl: string) =>
  content.replace(REGEX.TENOR_LINKS, '').replace(imgUrl, '');

export const trimAndCensorBannedWebhookWords = (content: string) =>
  content.slice(0, 35).replace(REGEX.BANNED_WEBHOOK_WORDS, '[censored]');

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
  // remove tenor links and image urls from the content
  let msgContent = message.content;

  if (opts?.attachmentURL) {
    msgContent = removeImgLinks(msgContent, opts.attachmentURL);
    censoredContent = removeImgLinks(censoredContent, opts.attachmentURL);
  }

  const embed = new EmbedBuilder()
    .setImage(opts?.attachmentURL ?? null)
    .setColor(opts?.embedCol ?? 'Random')
    .setAuthor({
      name: username,
      iconURL: message.author.displayAvatarURL(),
    })
    .setDescription(msgContent || null)
    .setFooter({
      text: `From: ${message.guild?.name}`,
      iconURL: message.guild?.iconURL() ?? undefined,
    });

  const censoredEmbed = EmbedBuilder.from(embed).setDescription(censoredContent || null);

  const formattedReply = opts?.referredContent?.replaceAll('\n', '\n> ');
  if (formattedReply) {
    embed.setFields({ name: 'Replying To:', value: `> ${formattedReply}` });
    censoredEmbed.setFields({ name: 'Replying To:', value: `> ${censor(formattedReply)}` });
  }

  return { embed, censoredEmbed };
};

export const generateJumpButton = (
  replyMsg: broadcastedMessages,
  referredAuthorUsername: string,
  serverId: string,
) => {
  // create a jump to reply button
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji(emojis.reply)
      .setURL(
        `https://discord.com/channels/${serverId}/${replyMsg.channelId}/${replyMsg.messageId}`,
      )
      .setLabel(
        referredAuthorUsername.length >= 80
          ? `@${referredAuthorUsername.slice(0, 76)}...`
          : `@${referredAuthorUsername}`,
      ),
  );
};

export const sendWelcomeMsg = async (message: Message, totalServers: string) => {
  await db.userData.upsert({
    where: { userId: message.author.id },
    create: {
      userId: message.author.id,
      username: message.author.username,
      viewedNetworkWelcome: true,
    },
    update: { viewedNetworkWelcome: true },
  });

  const linkButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji(emojis.add_icon)
      .setLabel('Invite Me!')
      .setURL(LINKS.APP_DIRECTORY),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji(emojis.code_icon)
      .setLabel('Support Server')
      .setURL(LINKS.SUPPORT_INVITE),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setEmoji(emojis.docs_icon)
      .setLabel('How-To Guide')
      .setURL(LINKS.DOCS),
  );

  await message.channel
    .send({
      content: t(
        { phrase: 'network.welcome', locale: message.author.locale ?? 'en' },
        {
          user: message.author.toString(),
          hub: hub.name,
          channel: message.channel.toString(),
          emoji: emojis.wave_anim,
          rules_command: '</rules:924659340898619395>',
          totalServers,
        },
      ),
      components: [linkButtons],
    })
    .catch(() => null);
};
