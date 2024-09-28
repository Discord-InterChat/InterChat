import { deleteConnection, deleteConnections } from '#main/utils/ConnectedListUtils.js';
import db from '#main/utils/Db.js';
import Logger from '#main/utils/Logger.js';
import { deleteMsgsFromDb, checkIfStaff } from '#main/utils/Utils.js';
import type { Hub } from '@prisma/client';
import { type WebhookMessageCreateOptions, WebhookClient } from 'discord.js';

/**
 * Sends a message to all connections in a hub's network.
 * @param hubId The ID of the hub to send the message to.
 * @param message The message to send. Can be a string or a MessageCreateOptions object.
 * @returns A array of the responses from each connection's webhook.
 */
export const sendToHub = async (hubId: string, message: string | WebhookMessageCreateOptions) => {
  const connections = await db.connectedList.findMany({ where: { hubId } });

  const res = connections
    .filter((c) => c.connected === true)
    .map(async ({ channelId, webhookURL, parentId }) => {
      const threadId = parentId ? channelId : undefined;
      const payload =
        typeof message === 'string' ? { content: message, threadId } : { ...message, threadId };

      try {
        const webhook = new WebhookClient({ url: webhookURL });
        return await webhook.send(payload);
      }
      catch (e) {
        // if the webhook is unknown, delete the connection
        if (e.message.includes('Unknown Webhook')) await deleteConnection({ channelId });

        e.message = `For Connection: ${channelId} ${e.message}`;
        Logger.error(e);
        return null;
      }
    });

  return await Promise.all(res);
};

export const deleteHubs = async (ids: string[]) => {
  // delete all relations first and then delete the hub
  await deleteConnections({ hubId: { in: ids } });
  await db.hubInvites.deleteMany({ where: { hubId: { in: ids } } });
  await db.originalMessages
    .findMany({ where: { hubId: { in: ids } }, include: { broadcastMsgs: true } })
    .then((m) =>
      deleteMsgsFromDb(
        m.map(({ broadcastMsgs }) => broadcastMsgs.map(({ messageId }) => messageId)).flat(),
      ),
    );

  // finally, delete the hub
  await db.hub.deleteMany({ where: { id: { in: ids } } });
};
export const fetchHub = async (id: string) => await db.hub.findFirst({ where: { id } });
export const isHubMod = (userId: string, hub: Hub) =>
  Boolean(hub.ownerId === userId || hub.moderators.find((mod) => mod.userId === userId));

export const isStaffOrHubMod = (userId: string, hub: Hub) =>
  checkIfStaff(userId) || isHubMod(userId, hub);
