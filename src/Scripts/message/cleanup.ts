import { Message } from 'discord.js';
import { NetworkSendResult, NetworkWebhookSendResult } from '../../Events/messageCreate';
import { updateConnection } from '../../Structures/network';
import { getDb } from '../../Utils/functions/utils';


export default {
  execute: async (message: Message, channelAndMessageIds: (NetworkWebhookSendResult | NetworkSendResult)[]) => {
    message.delete().catch(() => null);
    // All message data is stored in the database, so we can delete the message from the network later
    const invalidChannelIds: string[] = [];
    const invalidWebhookIds: string[] = [];

    const messageDataObj: { channelId: string, messageId: string }[] = [];

    const resolved = await Promise.all(channelAndMessageIds.map(async (obj) => {
      const msg = await obj.message;
      if (msg === undefined && 'webhookId' in obj) return { unknownWebhookId: obj.webhookId };
      else if (msg === undefined && 'channelId' in obj) return { unknownChannelId: obj.channelId };
      return msg;
    }));

    resolved.forEach((result) => {
      // eslint-disable-next-line
      const anyRes = result as any;
      if (anyRes?.unknownChannelId) invalidChannelIds.push(anyRes.unknownChannelId);
      if (anyRes?.unknownWebhookId) invalidWebhookIds.push(anyRes.unknownWebhookId);
      else if (anyRes.channelId || anyRes.channel_id) messageDataObj.push({ channelId: anyRes.channelId || anyRes.channel_id, messageId: anyRes.id });
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
