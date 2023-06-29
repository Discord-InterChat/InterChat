import { Message } from 'discord.js';
import { NetworkWebhookSendResult } from '../../Events/messageCreate';
import { getDb } from '../../Utils/functions/utils';

export default {
  /**
   * Disconnects connections if an errored occured while sending the message to it.
   * Otherwise, inserts messages into `messageData` collection for future use.
   */
  async execute(message: Message, channelAndMessageIds: NetworkWebhookSendResult[], hubId: string | null) {
    // All message data is stored in the database, so we can delete the message from the network later
    const messageDataObj: { channelId: string, messageId: string }[] = [];
    const invalidWebhookIds: string[] = [];

    channelAndMessageIds.forEach((result) => {
      if (!result.message) {
        invalidWebhookIds.push(result.webhookId);
      }
      else {
        messageDataObj.push({
          channelId: result.message.channel_id,
          messageId: result.message.id,
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
        },
      });
    }

    // disconnect network if, webhook does not exist/bot cannot access webhook
    if (invalidWebhookIds.length > 0) {
      await db.connectedList.updateMany({
        where: { webhook: { is: { id: { in: invalidWebhookIds } } } },
        data: { connected: false },
      });
    }
  },
};
