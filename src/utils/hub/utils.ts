import Context from '#src/core/CommandContext/Context.js';
import type HubManager from '#src/managers/HubManager.js';
import { HubService } from '#src/services/HubService.js';
import { InfoEmbed } from '#src/utils/EmbedUtils.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import { t } from '#src/utils/Locale.js';
import {
  deleteConnection,
  getHubConnections,
} from '#utils/ConnectedListUtils.js';
import {
  checkIfStaff,
  fetchUserLocale,
  getReplyMethod,
  handleError,
} from '#utils/Utils.js';
import type { HubModerator, Role } from '@prisma/client';
import {
  type RepliableInteraction,
  WebhookClient,
  type WebhookMessageCreateOptions,
} from 'discord.js';

/**
 * Sends a message to all connections in a hub's network.
 * @param hubId The ID of the hub to send the message to.
 * @param message The message to send. Can be a string or a MessageCreateOptions object.
 * @returns A array of the responses from each connection's webhook.
 */
export const sendToHub = async (
  hubId: string,
  message: string | WebhookMessageCreateOptions,
) => {
  const connections = await getHubConnections(hubId);
  if (!connections?.length) return;

  for (const { channelId, webhookURL, parentId, connected } of connections) {
    if (!connected) continue;

    const threadId = parentId ? channelId : undefined;
    const payload =
			typeof message === 'string'
			  ? { content: message, threadId }
			  : { ...message, threadId };

    try {
      const webhook = new WebhookClient({ url: webhookURL });
      await webhook.send({ ...payload, allowedMentions: { parse: [] } });
    }
    catch (e) {
      const validErrors = [
        'Unknown Webhook',
        'Invalid Webhook Token',
        'The provided webhook URL is not valid.',
      ];

      if (validErrors.includes(e.message)) await deleteConnection({ channelId });

      handleError(e, {
        comment: `Failed to send to connection ${channelId} ${e.message}`,
      });
    }
  }
};

export const isHubMod = (
  userId: string,
  mods: HubModerator[],
  checkRoles?: Role[],
) =>
  mods.some((mod) => {
    if (mod.userId !== userId) return false;
    if (!checkRoles) return true;

    return checkRoles.includes(mod.role);
  });

export const isStaffOrHubMod = async (userId: string, hub: HubManager) =>
  checkIfStaff(userId) || (await hub.isMod(userId));

interface ValidationCheck {
  condition: boolean;
  validator: () => Promise<boolean> | boolean;
  errorMessageKey:
		| 'hub.notManager'
		| 'hub.notModerator'
		| 'hub.notFound_mod'
		| 'hub.notOwner';
}

export const runHubPermissionChecksAndReply = async (
  hub: HubManager,
  context: Context | RepliableInteraction,
  options: {
    checkIfStaff?: boolean;
    checkIfManager?: boolean;
    checkIfMod?: boolean;
    checkIfOwner?: boolean;
  },
): Promise<boolean> => {
  const validationChecks: ValidationCheck[] = [
    {
      condition: Boolean(options.checkIfManager),
      validator: () => hub.isManager(context.user.id),
      errorMessageKey: 'hub.notManager',
    },
    {
      condition: Boolean(options.checkIfMod),
      validator: () => hub.isMod(context.user.id),
      errorMessageKey: 'hub.notModerator',
    },
    {
      condition: Boolean(options.checkIfMod),
      validator: () => hub.isOwner(context.user.id),
      errorMessageKey: 'hub.notOwner',
    },
  ];

  if (options.checkIfStaff && checkIfStaff(context.user.id)) return true;

  for (const check of validationChecks) {
    if (!check.condition) continue;

    const isValid = await check.validator();
    if (!isValid) {
      const embed = new InfoEmbed().setDescription(
        t(check.errorMessageKey, await fetchUserLocale(context.user.id), {
          emoji: getEmoji('x_icon', context.client),
        }),
      );

      if (context instanceof Context) {
        await context.reply({ embeds: [embed], flags: ['Ephemeral'] });
      }
      else {
        const replyMethod = getReplyMethod(context);
        await context[replyMethod]({ embeds: [embed], flags: ['Ephemeral'] });
      }
      return false;
    }
  }

  return true;
};

export const fetchHub = async ({
  id,
  name,
}: { id?: string; name?: string }) => {
  const hubService = new HubService();
  if (id) return await hubService.fetchHub(id);
  if (name) return (await hubService.findHubsByName(name)).at(0);
  return null;
};
