import { analyzeImageForNSFW, isUnsafeImage } from '#main/modules/NSFWDetection.js';
import { sendWelcomeMsg } from '#main/scripts/network/helpers.js';
import { HubSettingsBitField } from '#main/utils/BitFields.js';
import { emojis, REGEX } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { logBlacklist } from '#main/utils/HubLogger/ModLogs.js';
import logProfanity from '#main/utils/HubLogger/Profanity.js';
import { t } from '#main/utils/Locale.js';
import { check as checkProfanity } from '#main/utils/Profanity.js';
import { containsInviteLinks, replaceLinks } from '#main/utils/Utils.js';
import { hubs } from '@prisma/client';
import { EmbedBuilder, Message } from 'discord.js';
import { runAntiSpam } from './antiSpam.js';

// if account is created within the last 7 days
export const isNewUser = (message: Message) => {
  const sevenDaysAgo = Date.now() - (1000 * 60 * 60 * 24 * 7);
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

export const containsStickers = (message: Message) => message.stickers.size > 0 && !message.content;

export const isCaughtSpam = async (
  message: Message,
  settings: HubSettingsBitField,
  hubId: string,
) => {
  const antiSpamResult = runAntiSpam(message.author, 3);
  if (!antiSpamResult) return false;

  if (settings.has('SpamFilter') && antiSpamResult.infractions >= 3) {
    const expires = new Date(Date.now() + (60 * 5000));
    const reason = 'Auto-blacklisted for spamming.';
    const target = message.author;
    const mod = message.client.user;

    const { userManager } = message.client;

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

export const isNSFW = async (imgUrl: string | null | undefined) => {
  if (!imgUrl) return null;

  // run static images through the nsfw detector
  const predictions = await analyzeImageForNSFW(imgUrl);

  if (!predictions) return null;

  return isUnsafeImage(predictions);
};

export const containsLinks = (message: Message, settings: HubSettingsBitField) =>
  settings.has('HideLinks') &&
  !REGEX.STATIC_IMAGE_URL.test(message.content) &&
  REGEX.LINKS.test(message.content);

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
 * @param hub - The hub where the message is being sent in
 * @returns A boolean indicating whether the message passed all checks.
 */

export const runChecks = async (
  message: Message<true>,
  hub: hubs,
  opts: {
    settings: HubSettingsBitField;
    totalHubConnections: number;
    attachmentURL?: string | null;
  },
): Promise<boolean> => {
  const { hasProfanity, hasSlurs } = checkProfanity(message.content);
  const { settings, totalHubConnections, attachmentURL } = opts;
  const { userManager } = message.client;

  let userData = await userManager.getUser(message.author.id);
  let locale = userData ? await userManager.getUserLocale(userData) : undefined;
  if (!userData?.viewedNetworkWelcome) {
    userData = await db.userData.upsert({
      where: { id: message.author.id },
      create: {
        id: message.author.id,
        username: message.author.username,
        viewedNetworkWelcome: true,
      },
      update: { viewedNetworkWelcome: true },
    });

    locale = await userManager.getUserLocale(userData);

    await sendWelcomeMsg(message, locale, {
      hub: hub.name,
      totalServers: totalHubConnections.toString(),
    });
  }

  // banned / blacklisted
  const isUserBlacklisted = userData.blacklistedFrom.some((b) => b.hubId === hub.id);
  if (userData.banMeta?.reason || isUserBlacklisted) return false;

  if (containsLinks(message, settings)) message.content = replaceLinks(message.content);
  if (await isCaughtSpam(message, settings, hub.id)) return false;

  // send a log to the log channel set by the hub
  if (hasSlurs) return false;
  if (hasProfanity || hasSlurs) {
    logProfanity(hub.id, message.content, message.author, message.guild);
  }

  if (isNewUser(message)) {
    await replyToMsg(message, {
      content: t(
        { phrase: 'network.accountTooNew', locale },
        { user: message.author.toString(), emoji: emojis.no },
      ),
    });

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
      content: t({ phrase: 'errors.inviteLinks', locale }, { emoji: emojis.no }),
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

  if (await isNSFW(attachmentURL)) {
    const nsfwEmbed = new EmbedBuilder()
      .setTitle(t({ phrase: 'network.nsfw.title', locale }))
      .setDescription(
        t(
          { phrase: 'network.nsfw.description', locale },
          { rules_command: '</rules:924659340898619395>' },
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
