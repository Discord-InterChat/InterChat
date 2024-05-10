import { Message, EmbedBuilder } from 'discord.js';
import { HubSettingsBitField } from '../../utils/BitFields.js';
import { emojis, REGEX } from '../../utils/Constants.js';
import db from '../../utils/Db.js';
import { t } from '../../utils/Locale.js';
import { replaceLinks } from '../../utils/Utils.js';
import { check as checkProfanity } from '../../utils/Profanity.js';
import { runAntiSpam } from './antiSpam.js';

// if account is created within the last 7 days
export const isNewUser = (message: Message) => {
  const sevenDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
  return message.author.createdTimestamp > sevenDaysAgo;
};

export const isUserBlacklisted = async (message: Message, hubId: string) => {
  const isBlacklisted = await db.userData.findFirst({
    where: { userId: message.author.id, blacklistedFrom: { some: { hubId: { equals: hubId } } } },
  });

  return Boolean(isBlacklisted);
};

export const replyToMsg = async (message: Message, content: string) => {
  const reply = await message.reply(content).catch(() => null);
  if (!reply) {
    await message.channel.send(`${message.author.toString()} ${content}`).catch(() => null);
  }
};
export const containsStickers = (message: Message) => {
  return message.stickers.size > 0 && !message.content;
};

export const containsInviteLinks = (message: Message, settings: HubSettingsBitField) => {
  const inviteLinks = ['discord.gg', 'discord.com/invite', 'dsc.gg'];

  // check if message contains invite links from the array
  return settings.has('BlockInvites') && inviteLinks.some((link) => message.content.includes(link));
};
export const isCaughtSpam = async (
  message: Message,
  settings: HubSettingsBitField,
  hubId: string,
) => {
  const antiSpamResult = runAntiSpam(message.author, 3);
  if (!antiSpamResult) return false;
  const { blacklistManager } = message.client;

  if (settings.has('SpamFilter') && antiSpamResult.infractions >= 3) {
    await blacklistManager.addUserBlacklist(
      hubId,
      message.author.id,
      'Auto-blacklisted for spamming.',
      message.client.user.id,
      60 * 5000,
    );
    blacklistManager.scheduleRemoval('user', message.author.id, hubId, 60 * 5000);
    blacklistManager
      .notifyBlacklist(
        'user',
        message.author.id,
        hubId,
        new Date(Date.now() + 60 * 5000),
        'Auto-blacklisted for spamming.',
      )
      .catch(() => null);
  }

  message.react(emojis.timeout).catch(() => null);
  return true;
};

export const containsNSFW = async (message: Message, imgUrl: string | null | undefined) => {
  const { nsfwDetector } = message.client;
  const attachment = message.attachments.first();

  if (!imgUrl || !attachment) return;
  else if (!REGEX.STATIC_IMAGE_URL.test(imgUrl)) return;

  // run static images through the nsfw detector
  const predictions = await nsfwDetector.analyzeImage(attachment ? attachment.url : imgUrl);

  return {
    predictions,
    unsafe: (predictions && nsfwDetector.isUnsafeContent(predictions)) === true,
  };
};

export const containsLinks = (message: Message, settings: HubSettingsBitField) => {
  return (
    settings.has('HideLinks') &&
    !REGEX.IMAGE_URL.test(message.content) &&
    REGEX.LINKS.test(message.content)
  );
};
export const unsupportedAttachment = (message: Message) => {
  const attachment = message.attachments.first();
  const allowedTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/jpg'];

  return (attachment?.contentType && !allowedTypes.includes(attachment.contentType)) === true;
};

export const attachmentTooLarge = (message: Message) => {
  const attachment = message.attachments.first();
  return (attachment && attachment.size > 1024 * 1024 * 8) === true;
};
/**
 * Runs various checks on a message to determine if it can be sent in the network.
 * @param message - The message to check.
 * @param settings - The settings for the network.
 * @param hubId - The ID of the hub the message is being sent in.
 * @returns A boolean indicating whether the message passed all checks.
 */

export const runChecks = async (
  message: Message,
  settings: HubSettingsBitField,
  hubId: string,
  opts?: { attachmentURL?: string | null },
) => {
  const { locale } = message.author;
  const { profanity, slurs } = checkProfanity(message.content);

  if (!message.inGuild()) return false;
  if (await isUserBlacklisted(message, hubId)) return false;
  if (await isCaughtSpam(message, settings, hubId)) return false;
  if (containsLinks(message, settings)) message.content = replaceLinks(message.content);
  if (slurs) return false;

  if (profanity || slurs) {
    // send a log to the log channel set by the hub
    const { profanityLogger } = message.client;
    await profanityLogger.log(hubId, message.content, message.author, message.guild);
  }

  if (isNewUser(message)) {
    await message.channel
      .send(
        t(
          { phrase: 'network.accountTooNew', locale: message.author.locale },
          { user: message.author.toString(), emoji: emojis.no },
        ),
      )
      .catch(() => null);

    return false;
  }

  if (message.content.length > 1000) {
    await replyToMsg(message, 'Your message is too long! Please keep it under 1000 characters.');
    return false;
  }
  if (containsStickers(message)) {
    await replyToMsg(
      message,
      'Sending stickers in the network is not possible due to discord\'s limitations.',
    );
    return false;
  }
  if (containsInviteLinks(message, settings)) {
    await replyToMsg(
      message,
      'Advertising is not allowed. Set an invite in `/connection` instead!',
    );
    return false;
  }
  if (unsupportedAttachment(message)) {
    await replyToMsg(message, 'Only images and gifs are allowed to be sent within the network.');
    return false;
  }

  if (attachmentTooLarge(message)) {
    await replyToMsg(message, 'Please keep your attachments under 8MB.');
    return false;
  }

  const isNsfw = await containsNSFW(message, opts?.attachmentURL);
  if (isNsfw?.predictions) {
    const nsfwEmbed = new EmbedBuilder()
      .setTitle(t({ phrase: 'network.nsfw.title', locale }))
      .setDescription(
        t(
          { phrase: 'network.nsfw.description', locale },
          {
            predictions: `${Math.round(isNsfw.predictions[0].probability * 100)}%`,
            rules_command: '</rules:924659340898619395>',
          },
        ),
      )
      .setFooter({
        text: t({ phrase: 'network.nsfw.footer', locale }),
        iconURL: 'https://i.imgur.com/625Zy9W.png',
      })
      .setColor('Red');

    await message.channel.send({ content: `${message.author}`, embeds: [nsfwEmbed] });
    return false;
  }

  return true;
};
