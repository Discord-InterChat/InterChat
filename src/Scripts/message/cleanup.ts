import NetworkLeveling from '../../Structures/levels';
import { APIMessage, Message } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';

export interface InvalidChannelId {unknownChannelId?: string}
export interface InvalidWebhookId {unknownWebhookId?: string}

export default {
  execute: async (message: Message, channelAndMessageIds: Promise<Message | InvalidChannelId | InvalidWebhookId | APIMessage | undefined>[]) => {
    // Add levels and xp to user
    const Levels = new NetworkLeveling();
    const randomxp = Math.floor(Math.random() * 10) + 1;
    const user = await Levels.getUser(message.author.id).catch(() => null);
    const haslevelxp = await Levels.addXp(message.author.id, randomxp).catch(() => null);

    if (user && haslevelxp && haslevelxp.level > user.level) {
      message.channel.send(`🎉 ${message.author} Congrats you just leveled up to **${user.level}**!`);
    }

    message.delete().catch(() => null);

    // All message data is stored in the database, so we can delete the message from the network later
    const settledChannelMessages = await Promise.allSettled(channelAndMessageIds);
    const invalidChannelIds: string[] = [];
    const invalidWebhookIds: string[] = [];
    const messageDataObj: { channelId: string, messageId: string }[] = [];

    settledChannelMessages.forEach((result) => {
      if (result.status === 'rejected' || !result.value) return;
      // eslint-disable-next-line
      const anyRes = result as any;
      if (anyRes.value.unknownChannelId) invalidChannelIds.push(anyRes.value.unknownChannelId);
      else if (anyRes.value.unknownWebhookId) invalidWebhookIds.push(anyRes.value.unknownWebhookId);
      else if (anyRes.value.channelId || anyRes.value.channel_id) messageDataObj.push({ channelId: anyRes.value.channelId || anyRes.value.channel_id, messageId: anyRes.value.id });
    });

    // delete invalid channels from the database
    const db = getDb();
    // await db.connectedList?.deleteMany({ where: { channelId: { in: invalidChannelIds } } });
    await db.setup.updateMany({
      where: { webhook: { is: { id: { in: invalidWebhookIds } } } },
      data: { webhook: null },
    });

    // store message data in db
    if (message.guild) {
      await db.messageData.create({
        data: {
          channelAndMessageIds: messageDataObj,
          timestamp: message.createdTimestamp,
          authorId: message.author.id,
          serverId: message.guild.id,
          reference: message.reference,
          expired: false,
        },
      });
    }
  },
};