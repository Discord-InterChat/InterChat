import {
  deleteConnection,
  deleteConnections,
  getHubConnections,
} from '#utils/ConnectedListUtils.js';
import db from '#utils/Db.js';
import Logger from '#utils/Logger.js';
import { checkIfStaff } from '#utils/Utils.js';
import type { Hub } from '@prisma/client';
import { type WebhookMessageCreateOptions, WebhookClient } from 'discord.js';

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

      e.message = `For Connection: ${channelId} ${e.message}`;
      Logger.error(e);
    }
  };
};

export const deleteHubs = async (ids: string[]) => {
  // delete all relations first and then delete the hub
  await deleteConnections({ hubId: { in: ids } });
  await db.hubInvite.deleteMany({ where: { hubId: { in: ids } } });

  // finally, delete the hub
  await db.hub.deleteMany({ where: { id: { in: ids } } });
};
export const fetchHub = async (id: string) => await db.hub.findFirst({ where: { id } });
export const isHubMod = (userId: string, hub: Hub) =>
  Boolean(hub.ownerId === userId || hub.moderators.find((mod) => mod.userId === userId));

export const isStaffOrHubMod = (userId: string, hub: Hub) =>
  checkIfStaff(userId) || isHubMod(userId, hub);

export const isHubManager = (userId: string, hub: Hub) =>
  hub.ownerId === userId ||
  hub.moderators.find((mod) => mod.userId === userId && mod.position === 'manager');
