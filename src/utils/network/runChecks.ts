import BlacklistManager from '#src/managers/BlacklistManager.js';
import type HubManager from '#src/managers/HubManager.js';
import type HubSettingsManager from '#src/managers/HubSettingsManager.js';

import type { UserData } from '@prisma/client';
import { stripIndents } from 'common-tags';
import { type Awaitable, EmbedBuilder, type Message } from 'discord.js';
import NSFWDetector from '#src/modules/NSFWDetection.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import { sendBlacklistNotif } from '#src/utils/moderation/blacklistUtils.js';
import Constants from '#utils/Constants.js';
import { t } from '#utils/Locale.js';
import { check as checkProfanity } from '#utils/ProfanityUtils.js';
import { containsInviteLinks, fetchUserData, fetchUserLocale, replaceLinks } from '#utils/Utils.js';
import logProfanity from '#utils/hub/logger/Profanity.js';

export interface CheckResult {
  passed: boolean;
  reason?: string;
}

interface CheckFunctionOpts {
  userData: UserData;
  settings: HubSettingsManager;
  totalHubConnections: number;
  hub: HubManager;
  attachmentURL?: string | null;
}

type CheckFunction = (message: Message<true>, opts: CheckFunctionOpts) => Awaitable<CheckResult>;

// ordering is important - always check blacklists first (or they can bypass)
const checks: CheckFunction[] = [
  checkBanAndBlacklist,
  checkHubLock,
  checkSpam,
  checkProfanityAndSlurs,
  checkNewUser,
  checkMessageLength,
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
      .send({
        content: `${message.author.toString()} ${opts.content ?? ''}`,
        embeds,
      })
      .catch(() => null);
  }
};

export const runChecks = async (
  message: Message<true>,
  hub: HubManager,
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
  const userData = await fetchUserData(message.author.id);
  const blacklistManager = new BlacklistManager('user', message.author.id);
  const blacklisted = await blacklistManager.fetchBlacklist(opts.hub.id);

  if (userData?.banReason || blacklisted) {
    return { passed: false };
  }
  return { passed: true };
}

async function checkHubLock(
  message: Message<true>,
  { hub }: CheckFunctionOpts,
): Promise<CheckResult> {
  if (hub.data.locked && !(await hub.isMod(message.author.id))) {
    return {
      passed: false,
      reason:
        'This hub\'s chat has been locked. Only moderators can send messages. Please check back later as this may be temporary.',
    };
  }
  return { passed: true };
}

const containsLinks = (message: Message, settings: HubSettingsManager) =>
  settings.has('HideLinks') &&
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
  if (settings.has('SpamFilter') && result) {
    if (result.messageCount >= 6) {
      const expiresAt = new Date(Date.now() + 60 * 5000);
      const reason = 'Auto-blacklisted for spamming.';
      const target = message.author;
      const mod = message.client.user;

      const blacklistManager = new BlacklistManager('user', target.id);
      await blacklistManager.addBlacklist({
        hubId: hub.id,
        reason,
        expiresAt,
        moderatorId: mod.id,
      });

      await blacklistManager.log(hub.id, message.client, {
        mod,
        reason,
        expiresAt,
      });
      await sendBlacklistNotif('user', message.client, {
        target,
        hubId: hub.id,
        expiresAt,
        reason,
      }).catch(() => null);
    }

    await message.react(getEmoji('timeout', message.client)).catch(() => null);
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
    const locale = await fetchUserLocale(opts.userData);
    return {
      passed: false,
      reason: t('network.accountTooNew', locale, {
        user: message.author.toString(),
        emoji: getEmoji('x_icon', message.client),
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


async function checkInviteLinks(
  message: Message<true>,
  opts: CheckFunctionOpts,
): Promise<CheckResult> {
  const { settings, userData } = opts;

  if (settings.has('BlockInvites') && containsInviteLinks(message.content)) {
    const locale = await fetchUserLocale(userData);
    const emoji = getEmoji('x_icon', message.client);
    return {
      passed: false,
      reason: t('errors.inviteLinks', locale, { emoji }),
    };
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
    const predictions = await new NSFWDetector(attachmentURL).analyze();
    if (predictions.isNSFW && predictions.exceedsSafeThresh()) {
      const nsfwEmbed = new EmbedBuilder()
        .setColor(Constants.Colors.invisible)
        .setDescription(
          stripIndents`
          ### ${getEmoji('exclamation', message.client)} NSFW Image Blocked
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
