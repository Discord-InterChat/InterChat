import type HubManager from '#main/managers/HubManager.js';
import { deleteConnection, getHubConnections } from '#utils/ConnectedListUtils.js';
import { checkIfStaff, handleError } from '#utils/Utils.js';
import type { HubModerator, Role } from '@prisma/client';
import { WebhookClient, type WebhookMessageCreateOptions } from 'discord.js';

/**
 * Sends a message to all connections in a hub's network.
 * @param hubId The ID of the hub to send the message to.
 * @param message The message to send. Can be a string or a MessageCreateOptions object.
 * @returns A array of the responses from each connection's webhook.
 */
export const sendToHub = async (hubId: string, message: string | WebhookMessageCreateOptions) => {
  const connections = await getHubConnections(hubId);
  if (!connections?.length) return;

  for (const { channelId, webhookURL, parentId, connected } of connections) {
    if (!connected) continue;

    const threadId = parentId ? channelId : undefined;
    const payload =
      typeof message === 'string' ? { content: message, threadId } : { ...message, threadId };

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

      handleError(e, { comment: `Failed to send to connection ${channelId} ${e.message}` });
    }
  }
};

export const isHubMod = (userId: string, mods: HubModerator[], checkRoles?: Role[]) =>
  mods.some((mod) => {
    if (mod.userId !== userId) return false;
    if (!checkRoles) return true;

    return checkRoles.includes(mod.role);
  });

export const isStaffOrHubMod = async (userId: string, hub: HubManager) =>
  checkIfStaff(userId) || (await hub.isMod(userId));
