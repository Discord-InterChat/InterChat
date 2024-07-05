import logProfanity from '../../utils/HubLogger/Profanity.js';
import { Message, EmbedBuilder } from 'discord.js';
import { HubSettingsBitField } from '../../utils/BitFields.js';
import { emojis, REGEX } from '../../utils/Constants.js';
import { t } from '../../utils/Locale.js';
import { containsInviteLinks, replaceLinks } from '../../utils/Utils.js';
import { check as checkProfanity } from '../../utils/Profanity.js';
import { runAntiSpam } from './antiSpam.js';
import { analyzeImageForNSFW, isUnsafeImage } from '../../utils/NSFWDetection.js';
import { logBlacklist } from '../../utils/HubLogger/ModLogs.js';
import { userData as userDataCol } from '@prisma/client';

// if account is created within the last 7 days
export const isNewUser = (message: Message) => {
  const sevenDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
  return message.author.createdTimestamp > sevenDaysAgo;
};

export const replyToMsg = async (
  message: Message,
  opts: { content?: string; embed?: EmbedBuilder },
) => {
  const embeds = opts.embed ? [opts.embed] : [];

  const reply = await message.reply({ content: opts.content, embeds }).catch(() => null);
  if (!reply) {
    await message.channel
      .send({ content: `${message.author.toString()} ${opts.content ?? ''}`, embeds })
      .catch(() => null);
  }
};

export const containsStickers = (message: Message) => {
  return message.stickers.size > 0 && !message.content;
};

export const isCaughtSpam = async (
  message: Message,
  settings: HubSettingsBitField,
  hubId: string,
) => {
  const antiSpamResult = runAntiSpam(message.author, 3);
  if (!antiSpamResult) return false;
  /* NOTE: Don't use { addUserBlacklist, notifyBlacklist } it makes the methods lose their "this" property
    better to not have a class like this at all tbh */
  const { userManager } = message.client;

  if (settings.has('SpamFilter') && antiSpamResult.infractions >= 3) {
    const expires = new Date(Date.now() + 60 * 5000);
    const reason = 'Auto-blacklisted for spamming.';
    const target = message.author;
    const mod = message.client.user;

    await userManager.addBlacklist({ id: target.id, name: target.username }, hubId, {
      reason,
      expires,
      moderatorId: mod.id,
    });
    await userManager.sendNotification({ target, hubId, expires, reason }).catch(() => null);
    await logBlacklist(hubId, message.client, { target, mod, reason, expires }).catch(() => null);
  }

  await message.react(emojis.timeout).catch(() => null);
  return true;
};

export const containsNSFW = async (message: Message, imgUrl: string | null | undefined) => {
  const attachment = message.attachments.first();

  if (!imgUrl || !attachment) return null;
  // run static images through the nsfw detector
  const predictions = await analyzeImageForNSFW(attachment ? attachment.url : imgUrl);

  if (!predictions) return null;

  return {
    predictions,
    unsafe: isUnsafeImage(predictions),
  };
};

export const containsLinks = (message: Message, settings: HubSettingsBitField) => {
  return (
    settings.has('HideLinks') &&
    !REGEX.STATIC_IMAGE_URL.test(message.content) &&
    REGEX.LINKS.test(message.content)
  );
};
export const unsupportedAttachment = (message: Message) => {
  const attachment = message.attachments.first();
  // NOTE: Even 'image/gif' was allowed before
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];

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
  message: Message<true>,
  hubId: string,
  opts: { settings: HubSettingsBitField; userData: userDataCol; attachmentURL?: string | null },
): Promise<boolean> => {
  const { locale } = message.author;
  const { hasProfanity, hasSlurs } = checkProfanity(message.content);
  const { settings, userData, attachmentURL } = opts;
  const isUserBlacklisted = userData.blacklistedFrom.some((b) => b.hubId === hubId);

  // banned / blacklisted
  if (userData.banMeta?.reason || isUserBlacklisted) return false;
  if (containsLinks(message, settings)) message.content = replaceLinks(message.content);
  if (await isCaughtSpam(message, settings, hubId)) return false;

  // send a log to the log channel set by the hub
  if (hasProfanity || hasSlurs) {
    logProfanity(hubId, message.content, message.author, message.guild);
    if (hasSlurs) return false;
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
    await replyToMsg(message, {
      content: 'Your message is too long! Please keep it under 1000 characters.',
    });
    return false;
  }
  if (containsStickers(message)) {
    await replyToMsg(message, {
      content: 'Sending stickers in the network is not possible due to discord\'s limitations.',
    });
    return false;
  }
  if (settings.has('BlockInvites') && containsInviteLinks(message.content)) {
    await replyToMsg(message, {
      content: 'Advertising is not allowed. Set an invite in `/connection` instead!',
    });
    return false;
  }
  if (unsupportedAttachment(message)) {
    await replyToMsg(message, {
      content: 'Only images and tenor gifs are allowed to be sent within the network.',
    });
    return false;
  }

  if (attachmentTooLarge(message)) {
    await replyToMsg(message, { content: 'Please keep your attachments under 8MB.' });
    return false;
  }

  const isNsfw = await containsNSFW(message, attachmentURL);
  if (isNsfw?.unsafe) {
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

    await replyToMsg(message, { content: `${message.author}`, embed: nsfwEmbed });
    return false;
  }

  return true;
};
