import { Message } from 'discord.js';
import { NetworkWebhookSendResult } from '../../Events/messageCreate';
import { getDb } from '../../Utils/functions/utils';

/**
  * Disconnects connections if an errored occured while sending the message to it.
  * Otherwise, inserts messages into `messageData` collection for future use.
  */
export default async function execute(message: Message, channelAndMessageIds: NetworkWebhookSendResult[], hubId: string | null) {
  const messageDataObj: { channelId: string, messageId: string }[] = [];
  const invalidWebhookURLs: string[] = [];

  channelAndMessageIds.forEach((result) => {
    if (typeof result.messageOrError === 'string') {
      if (
        result.messageOrError.includes('Invalid Webhook Token') ||
        result.messageOrError.includes('Unknown Webhook')
      ) invalidWebhookURLs.push(result.webhookURL);
    }
    else {
      messageDataObj.push({
        channelId: result.messageOrError.channel_id,
        messageId: result.messageOrError.id,
      });
    }
  });

  const db = getDb();
  if (message.guild && hubId) {
    // store message data in db
    await db.messageData.create({
      data: {
        hub: { connect: { id: hubId } },
        channelAndMessageIds: messageDataObj,
        timestamp: message.createdAt,
        authorId: message.author.id,
        serverId: message.guild.id,
        reference: message.reference,
        reactions: {},
      },
    });
  }

  // disconnect network if, webhook does not exist/bot cannot access webhook
  if (invalidWebhookURLs.length > 0) {
    await db.connectedList.updateMany({
      where: { webhookURL: { in: invalidWebhookURLs } },
      data: { connected: false },
    });
  }
}
