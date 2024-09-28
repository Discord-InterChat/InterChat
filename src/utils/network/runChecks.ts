import { analyzeImageForNSFW, isImageUnsafe } from '#main/modules/NSFWDetection.js';
import { sendWelcomeMsg } from '#main/utils/network/helpers.js';
import Constants, { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { logBlacklist } from '#main/utils/HubLogger/ModLogs.js';
import logProfanity from '#main/utils/HubLogger/Profanity.js';
import { t } from '#main/utils/Locale.js';
import { check as checkProfanity } from '#main/utils/ProfanityUtils.js';
import { containsInviteLinks, replaceLinks } from '#main/utils/Utils.js';
import { Hub } from '@prisma/client';
import { EmbedBuilder, Message } from 'discord.js';
import { runAntiSpam } from './antiSpam.js';
import HubSettingsManager from '#main/modules/HubSettingsManager.js';
import { stripIndents } from 'common-tags';
import { sendBlacklistNotif } from '#main/utils/moderation/blacklistUtils.js';
import UserInfractionManager from '#main/modules/InfractionManager/UserInfractionManager.js';
import BlacklistManager from '#main/modules/BlacklistManager.js';

// if account is created within the last 7 days
const isNewUser = (message: Message) => {
  const sevenDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
  return message.author.createdTimestamp > sevenDaysAgo;
};

const replyToMsg = async (
  message: Message<true>,
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

const containsStickers = (message: Message) => message.stickers.size > 0 && !message.content;

const isCaughtSpam = async (message: Message, settings: HubSettingsManager, hubId: string) => {
  const antiSpamResult = runAntiSpam(message.author, 3);
  if (!antiSpamResult) return false;

  if (settings.getSetting('SpamFilter') && antiSpamResult.infractions >= 3) {
    const expiresAt = new Date(Date.now() + 60 * 5000);
    const reason = 'Auto-blacklisted for spamming.';
    const target = message.author;
    const mod = message.client.user;

    const blacklistManager = new BlacklistManager(new UserInfractionManager(target.id));

    await blacklistManager.addBlacklist({ hubId, reason, expiresAt, moderatorId: mod.id });
    await logBlacklist(hubId, message.client, { target, mod, reason, expiresAt }).catch(() => null);
    await sendBlacklistNotif('user', message.client, { target, hubId, expiresAt, reason }).catch(
      () => null,
    );
  }

  await message.react(emojis.timeout).catch(() => null);
  return true;
};

const isStaticAttachmentURL = (imgUrl: string) => Constants.Regex.StaticImageUrl.test(imgUrl);
const isNSFW = async (imgUrl: string | null | undefined) => {
  if (!imgUrl || !isStaticAttachmentURL(imgUrl)) return null;

  // run static images through the nsfw detector
  const predictions = await analyzeImageForNSFW(imgUrl);
  if (predictions.length < 1) return null;

  return isImageUnsafe(predictions[0]);
};

const containsLinks = (message: Message, settings: HubSettingsManager) =>
  settings.getSetting('HideLinks') &&
  !Constants.Regex.StaticImageUrl.test(message.content) &&
  Constants.Regex.Links.test(message.content);

const unsupportedAttachment = (message: Message) => {
  const attachment = message.attachments.first();
  // NOTE: Even 'image/gif' was allowed before
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

  return Boolean(attachment?.contentType && !allowedTypes.includes(attachment.contentType));
};

const attachmentTooLarge = (message: Message) => {
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
  hub: Hub,
  opts: {
    settings: HubSettingsManager;
    totalHubConnections: number;
    attachmentURL?: string | null;
  },
): Promise<boolean> => {
  const { hasProfanity, hasSlurs } = checkProfanity(message.content);
  const { settings, totalHubConnections, attachmentURL } = opts;
  const { userManager } = message.client;

  let userData = await userManager.getUser(message.author.id);
  let locale = await userManager.getUserLocale(userData);
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
  const blacklistManager = new BlacklistManager(new UserInfractionManager(message.author.id));
  const blacklisted = await blacklistManager.fetchBlacklist(hub.id);
  if (userData?.banMeta?.reason || blacklisted) return false;

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
  if (settings.getSetting('BlockInvites') && containsInviteLinks(message.content)) {
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
      .setColor(Constants.Colors.invisible)
      .setDescription(
        stripIndents`
        ### ${emojis.exclamation} NSFW Image Blocked
        Images that contain NSFW (Not Safe For Work) content are not allowed on InterChat and may result in a blacklist from the hub and bot.
        `,
      )
      .setFooter({
        text: `Notification sent for: ${message.author.username}`,
        iconURL: message.author.displayAvatarURL(),
      });

    await replyToMsg(message, { embed: nsfwEmbed });
    return false;
  }

  return true;
};
