import BlacklistManager from '#main/managers/BlacklistManager.js';
import HubSettingsManager from '#main/managers/HubSettingsManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import { analyzeImageForNSFW, isImageUnsafe } from '#main/modules/NSFWDetection.js';
import { sendBlacklistNotif } from '#main/utils/moderation/blacklistUtils.js';
import Constants, { emojis } from '#utils/Constants.js';
import logProfanity from '#utils/hub/logger/Profanity.js';
import { isHubMod } from '#utils/hub/utils.js';
import { t } from '#utils/Locale.js';
import { check as checkProfanity } from '#utils/ProfanityUtils.js';
import { containsInviteLinks, replaceLinks } from '#utils/Utils.js';
import { Hub, MessageBlockList, UserData } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { Awaitable, EmbedBuilder, Message } from 'discord.js';

interface CheckResult {
  passed: boolean;
  reason?: string;
}

interface CheckFunctionOpts {
  userData: UserData;
  settings: HubSettingsManager;
  totalHubConnections: number;
  hub: Hub & { msgBlockList: MessageBlockList[] };
  attachmentURL?: string | null;
}

type CheckFunction = (message: Message<true>, opts: CheckFunctionOpts) => Awaitable<CheckResult>;

const checks: CheckFunction[] = [
  checkBanAndBlacklist,
  checkHubLock,
  checkSpam,
  checkProfanityAndSlurs,
  checkNewUser,
  checkMessageLength,
  checkStickers,
  checkInviteLinks,
  checkAttachments,
  checkNSFW,
  checkLinks,
];

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

export const runChecks = async (
  message: Message<true>,
  hub: Hub & { msgBlockList: MessageBlockList[] },
  opts: {
    userData: UserData;
    settings: HubSettingsManager;
    totalHubConnections: number;
    attachmentURL?: string | null;
  },
): Promise<boolean> => {
  for (const check of checks) {
    const result = await check(message, { ...opts, hub });
    if (!result.passed) {
      if (result.reason) await replyToMsg(message, { content: result.reason });
      return false;
    }
  }

  return true;
};

async function checkBanAndBlacklist(
  message: Message<true>,
  opts: CheckFunctionOpts,
): Promise<CheckResult> {
  const { userManager } = message.client;
  const userData = await userManager.getUser(message.author.id);
  const blacklistManager = new BlacklistManager(new UserInfractionManager(message.author.id));
  const blacklisted = await blacklistManager.fetchBlacklist(opts.hub.id);

  if (userData?.banMeta?.reason || blacklisted) {
    return { passed: false };
  }
  return { passed: true };
}

function checkHubLock(message: Message<true>, { hub }: CheckFunctionOpts): CheckResult {
  if (hub.locked && !isHubMod(message.author.id, hub)) {
    return { passed: false, reason: 'This hub is currently locked.' };
  }
  return { passed: true };
}

const containsLinks = (message: Message, settings: HubSettingsManager) =>
  settings.getSetting('HideLinks') &&
  !Constants.Regex.StaticImageUrl.test(message.content) &&
  Constants.Regex.Links.test(message.content);

function checkLinks(message: Message<true>, opts: CheckFunctionOpts): CheckResult {
  const { settings } = opts;
  if (containsLinks(message, settings)) {
    message.content = replaceLinks(message.content);
  }
  return { passed: true };
}

async function checkSpam(message: Message<true>, opts: CheckFunctionOpts): Promise<CheckResult> {
  const { settings, hub } = opts;
  const result = await message.client.antiSpamManager.handleMessage(message);
  if (settings.getSetting('SpamFilter') && result) {
    if (result.messageCount >= 6) {
      const expiresAt = new Date(Date.now() + 60 * 5000);
      const reason = 'Auto-blacklisted for spamminag.';
      const target = message.author;
      const mod = message.client.user;

      const blacklistManager = new BlacklistManager(new UserInfractionManager(target.id));
      await blacklistManager.addBlacklist({
        hubId: hub.id,
        reason,
        expiresAt,
        moderatorId: mod.id,
      });

      await blacklistManager.log(hub.id, message.client, { mod, reason, expiresAt });
      await sendBlacklistNotif('user', message.client, {
        target,
        hubId: hub.id,
        expiresAt,
        reason,
      }).catch(() => null);
    }

    await message.react(emojis.timeout).catch(() => null);
    return { passed: false };
  }
  return { passed: true };
}

function checkProfanityAndSlurs(message: Message<true>, { hub }: CheckFunctionOpts): CheckResult {
  const { hasProfanity, hasSlurs } = checkProfanity(message.content);
  if (hasProfanity || hasSlurs) {
    logProfanity(hub.id, message.content, message.author, message.guild);
  }

  if (hasSlurs) return { passed: false };
  return { passed: true };
}

async function checkNewUser(message: Message<true>, opts: CheckFunctionOpts): Promise<CheckResult> {
  const sevenDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;

  if (message.author.createdTimestamp > sevenDaysAgo) {
    const locale = await message.client.userManager.getUserLocale(opts.userData);
    return {
      passed: false,
      reason: t('network.accountTooNew', locale, {
        user: message.author.toString(),
        emoji: emojis.no,
      }),
    };
  }

  return { passed: true };
}

function checkMessageLength(message: Message<true>): CheckResult {
  if (message.content.length > 1000) {
    return {
      passed: false,
      reason: 'Your message is too long! Please keep it under 1000 characters.',
    };
  }
  return { passed: true };
}

function checkStickers(message: Message<true>): CheckResult {
  if (message.stickers.size > 0 && !message.content) {
    return {
      passed: false,
      reason: 'Sending stickers in the network is not possible due to discord\'s limitations.',
    };
  }
  return { passed: true };
}

async function checkInviteLinks(
  message: Message<true>,
  opts: CheckFunctionOpts,
): Promise<CheckResult> {
  const { settings, userData } = opts;

  if (settings.getSetting('BlockInvites') && containsInviteLinks(message.content)) {
    const locale = await message.client.userManager.getUserLocale(userData);
    return { passed: false, reason: t('errors.inviteLinks', locale, { emoji: emojis.no }) };
  }
  return { passed: true };
}

function checkAttachments(message: Message<true>): CheckResult {
  const attachment = message.attachments.first();
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

  if (attachment?.contentType && !allowedTypes.includes(attachment.contentType)) {
    return {
      passed: false,
      reason: 'Only images and tenor gifs are allowed to be sent within the network.',
    };
  }

  if (attachment && attachment.size > 1024 * 1024 * 8) {
    return { passed: false, reason: 'Please keep your attachments under 8MB.' };
  }

  return { passed: true };
}

async function checkNSFW(message: Message<true>, opts: CheckFunctionOpts): Promise<CheckResult> {
  const { attachmentURL } = opts;
  if (attachmentURL && Constants.Regex.StaticImageUrl.test(attachmentURL)) {
    const predictions = await analyzeImageForNSFW(attachmentURL);
    if (isImageUnsafe(predictions.at(0))) {
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
      return { passed: false };
    }
  }
  return { passed: true };
}
