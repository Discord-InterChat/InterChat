import { Message } from 'discord.js';
import { NetworkSendResult, NetworkWebhookSendResult } from '../../Events/messageCreate';
import { updateConnection } from '../../Structures/network';
import { getDb } from '../../Utils/functions/utils';


export default {
  execute: async (message: Message, channelAndMessageIds: Promise<NetworkWebhookSendResult | NetworkSendResult>[]) => {
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

    // store message data in db
    if (message.guild) {
      const { messageData } = getDb();
      await messageData.create({
        data: {
          channelAndMessageIds: messageDataObj,
          timestamp: message.createdTimestamp,
          authorId: message.author.id,
          serverId: message.guild.id,
          reference: message.reference,
        },
      });
    }

    // delete invalid channels from the database
    await updateConnection({ webhook: { is: { id: { in: invalidWebhookIds } } } }, { webhook: null });
    await updateConnection({ channelId: { in: invalidChannelIds } }, { connected: false });
  },
};
