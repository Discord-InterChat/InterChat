import { APIMessage, Message } from 'discord.js';
import { getDb } from '../../Utils/functions/utils';
import logger from '../../Utils/logger';


export interface InvalidChannelId {unknownChannelId?: string}
export interface InvalidWebhookId {unknownWebhookId?: string}


export default {
  execute: async (message: Message, channelAndMessageIds: Promise<Message | InvalidChannelId | InvalidWebhookId | APIMessage>[]) => {

    message.delete().catch(() => null);
    // All message data is stored in the database, so we can delete the message from the network later
    Promise.allSettled(channelAndMessageIds)
      .then(async (data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fulfilledResults = data.filter(d => d.status === 'fulfilled' && d.value) as PromiseFulfilledResult<any>[];

        // make a new array that contains only the invalid channel ids
        const invalidChannelIds = fulfilledResults
          .filter(invalidChannel => invalidChannel.value.unknownChannelId)
          .map((invalidChannel: PromiseFulfilledResult<InvalidChannelId>) => invalidChannel.value.unknownChannelId);

        const invalidWebhooks = fulfilledResults
          .filter(invalidWebhook => invalidWebhook.value.unknownWebhookId)
          .map((invalidWebhook: PromiseFulfilledResult<InvalidWebhookId>) => invalidWebhook.value.unknownWebhookId);

        // make a new array with data that contains the message id and channel id
        // required for performing network actions (delete/edit messages)
        const messageDataObj = fulfilledResults
          .filter(msg => (msg.value.channelId || msg.value.channel_id) && msg.value.id)
          .map((msg: PromiseFulfilledResult<any>) => {return { channelId: msg.value.channelId || msg.value.channel_id, messageId: msg.value.id };});

        const db = getDb();

        // delete invalid channels from the database
        await db.connectedList?.deleteMany({ where: { channelId: { in: String(invalidChannelIds) } } });
        await db.setup.updateMany({
          where: { webhook: { is: { id: { in: String(invalidWebhooks) } } } },
          data: { webhook: null },
        });


        // store message data in db
        if (message.guild) {
          await db.messageData.create({
            data: {
              channelAndMessageIds: messageDataObj,
              timestamp: message.createdTimestamp,
              authorId: message.author.id,
              serverId: message.guild?.id,
              reference: message.reference,
              expired: false,
            },
          });
        }
      })
      .catch(logger.error);

  },
};