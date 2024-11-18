import BlacklistManager from '#main/managers/BlacklistManager.js';
import UserInfractionManager from '#main/managers/InfractionManager/UserInfractionManager.js';
import { logBlockwordAlert } from '#main/utils/hub/logger/BlockWordAlert.js';
import Logger from '#main/utils/Logger.js';
import { sendBlacklistNotif } from '#main/utils/moderation/blacklistUtils.js';
import { createRegexFromWords } from '#main/utils/moderation/blockWords.js';
import { BlockWordAction, MessageBlockList } from '@prisma/client';
import { ActionRowBuilder, Awaitable, ButtonBuilder, Message } from 'discord.js';

// Interface for action handler results
interface ActionResult {
  success: boolean;
  shouldBlock: boolean;
  components?: ActionRowBuilder<ButtonBuilder>[];
  message?: string;
}

// Action handler type
type ActionHandler = (
  message: Message<true>,
  rule: MessageBlockList,
  matches: string[],
) => Awaitable<ActionResult>;

// Map of action handlers
const actionHandlers: Record<BlockWordAction, ActionHandler> = {
  [BlockWordAction.BLOCK_MESSAGE]: () => ({
    success: true,
    shouldBlock: true,
    message: 'Message blocked due to containing prohibited words.',
  }),

  [BlockWordAction.SEND_ALERT]: async (message, rule, matches) => {
    // Send alert to moderators
    await logBlockwordAlert(message, rule, matches);
    return { success: true, shouldBlock: false };
  },

  [BlockWordAction.BLACKLIST]: async (message, rule) => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const reason = `Auto-blacklisted for using blocked words (Rule: ${rule.name})`;
    const target = message.author;
    const mod = message.client.user;

    const blacklistManager = new BlacklistManager(new UserInfractionManager(target.id));
    await blacklistManager.addBlacklist({
      hubId: rule.hubId,
      reason,
      expiresAt,
      moderatorId: mod.id,
    });

    await blacklistManager.log(rule.hubId, message.client, { mod, reason, expiresAt });
    await sendBlacklistNotif('user', message.client, {
      target,
      hubId: rule.hubId,
      expiresAt,
      reason,
    }).catch(() => null);

    return {
      success: true,
      shouldBlock: true,
      message: 'You have been blacklisted for using prohibited words.',
    };
  },
};

export async function checkBlockedWords(message: Message<true>, msgBlockList: MessageBlockList[]) {
  if (msgBlockList.length === 0) return Promise.resolve({ passed: true });

  for (const rule of msgBlockList) {
    const regex = createRegexFromWords(rule.words);
    const matches = message.content.match(regex);

    if (matches) {
      let shouldBlock = false;
      let blockReason: string | undefined;

      // Execute all configured actions for this rule
      for (const action of rule.actions || []) {
        const handler = actionHandlers[action];
        if (handler) {
          try {
            const result = await handler(message, rule, matches);
            if (result.success && result.shouldBlock) {
              shouldBlock = true;
              blockReason = result.message;
            }
          }
          catch (error) {
            Logger.error(`Failed to execute action ${action}:`, error);
          }
        }
      }

      // If no specific blocking actions were taken but actions were configured,
      // still block the message by default
      if (rule.actions?.length && !shouldBlock) {
        shouldBlock = true;
        blockReason = `Your message contains blocked words from the rule: ${rule.name}`;
      }

      if (shouldBlock) {
        return {
          passed: false,
          reason: blockReason,
        };
      }
    }
  }

  return { passed: true };
}
