import { Message } from 'discord.js';
import { NetworkSendResult, NetworkWebhookSendResult } from '../../Events/messageCreate';
import { getDb } from '../../Utils/functions/utils';

export default {
  async execute(
    message: Message,
    channelAndMessageIds: Promise<NetworkWebhookSendResult | NetworkSendResult>[],
    hubId: string | null,
  ) {
    message.delete().catch(() => null);
    // All message data is stored in the database, so we can delete the message from the network later
    const invalidChannelIds: string[] = [];
    const invalidWebhookIds: string[] = [];

    const messageDataObj: { channelId: string, messageId: string }[] = [];

    const resolved = await Promise.all(channelAndMessageIds);
    resolved.forEach((result) => {
      if (result.message === undefined && 'webhookId' in result) invalidWebhookIds.push(result.webhookId);
      else if (result.message === undefined && 'channelId' in result) invalidChannelIds.push(result.channelId);

      if (result.message) {
        // normal message
        if ('channelId' in result) {
          messageDataObj.push({
            channelId: result.channelId,
            messageId: result.message.id,
          });
        }
        // webhook message (channel_id instead of channelId)
        else if (result.message.channel_id) {
          messageDataObj.push({
            channelId: result.message.channel_id,
            messageId: result.message.id,
          });
        }
      }
    });

    const db = getDb();
    // store message data in db
    if (message.guild && hubId) {
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

    // remove invalid webhooks from database
    await db.connectedList.updateMany({
      where: { webhook: { is: { id: { in: invalidWebhookIds } } } },
      data:{ webhook: null },
    });
    // disconnect invalid channels from the database
    await db.connectedList.updateMany({
      where: { channelId: { in: invalidChannelIds } },
      data: { connected: false },
    });
  },
};
