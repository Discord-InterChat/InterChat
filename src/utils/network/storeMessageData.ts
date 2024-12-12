import { ConnectionMode } from '#utils/Constants.js';
import {
  addBroadcasts,
  Broadcast,
  OriginalMessage,
  storeMessage,
  storeMessageTimestamp,
} from '#main/utils/network/messageUtils.js';
import { updateConnections } from '#utils/ConnectedListUtils.js';
import { type APIMessage, type Message } from 'discord.js';

interface ErrorResult {
  webhookURL: string;
  error: string;
}

interface SendResult {
  messageRes: APIMessage;
  mode: ConnectionMode;
  webhookURL: string;
}

export type NetworkWebhookSendResult = ErrorResult | SendResult;

/**
 * Stores message data in the database and updates the Connection based on the webhook status.
 * @param channelAndMessageIds The result of sending the message to multiple channels.
 * @param hubId The ID of the hub to connect the message data to.
 */
export default async (
  message: Message,
  broadcastResults: NetworkWebhookSendResult[],
  hubId: string,
  dbReference?: OriginalMessage | null,
) => {
  if (!message.inGuild()) return;

  await storeMessage(message.id, {
    hubId,
    messageId: message.id,
    authorId: message.author.id,
    guildId: message.guildId,
    referredMessageId: dbReference?.messageId,
    timestamp: message.createdTimestamp,
  });

  const invalidWebhookURLs: string[] = [];
  const validBroadcasts: Broadcast[] = [];
  const validErrors = [
    'Unknown Webhook',
    'Unknown Channel',
    'Missing Permissions',
    'Invalid Webhook Token',
    'The provided webhook URL is not valid.',
  ];

  // loop through all results and extract message data and invalid webhook urls
  broadcastResults.forEach((res) => {
    if ('error' in res) {
      if (validErrors.some((e) => res.error.includes(e))) invalidWebhookURLs.push(res.webhookURL);
      return;
    }
    validBroadcasts.push({
      mode: res.mode,
      messageId: res.messageRes.id,
      channelId: res.messageRes.channel_id,
      originalMsgId: message.id,
    });
  });

  if (validBroadcasts.length > 0) await addBroadcasts(hubId, message.id, ...validBroadcasts);
  await storeMessageTimestamp(message);

  // disconnect network if, webhook does not exist/bot cannot access webhook
  if (invalidWebhookURLs.length > 0) {
    await updateConnections({ webhookURL: { in: invalidWebhookURLs } }, { connected: false });
  }
};
