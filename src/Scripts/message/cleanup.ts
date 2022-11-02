import { APIMessage, Message } from 'discord.js';
import { Collection } from 'mongodb';
import { connectedListDocument, setupDocument } from '../../Utils/typings/types';
import logger from '../../Utils/logger';
import { getDb } from '../../Utils/functions/utils';


export interface InvalidChannelId {unknownChannelId?: string}
export interface InvalidWebhookId {unknownWebhookId?: string}


export default {
	execute: async (message: Message, channelAndMessageIds: Promise<Message | InvalidChannelId>[]) => {
		message.delete().catch(() => null);
		// All message data is stored in the database, so we can delete the message from the network later
		Promise.allSettled(channelAndMessageIds)
			.then((data) => {
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
				let messageDataObj = fulfilledResults
					.filter(msg => msg.value.channelId && msg.value.id)
					.map((msg: PromiseFulfilledResult<Message>) => {return { channelId: msg.value.channelId, messageId: msg.value.id };});

				const webhookDataObj = fulfilledResults
					.filter(msg => msg.value.channel_id && msg.value.id)
					.map((msg: PromiseFulfilledResult<APIMessage>) => {return { channelId: msg.value.channel_id, messageId: msg.value.id };});


				if (webhookDataObj.length > 0) messageDataObj = messageDataObj.concat(webhookDataObj);

				const db = getDb();
				const connectedList = db?.collection('connectedList') as Collection<connectedListDocument> | undefined;
				const messageData = db?.collection('messageData');
				const setupList = db?.collection('setup') as Collection<setupDocument> | undefined;

				// delete invalid channels from the database
				connectedList?.deleteMany({ channelId: { $in: invalidChannelIds } });
				setupList?.updateMany({ 'webhook.id' : { $in: invalidWebhooks } }, { $set: { webhook: null } });

				// store message data in db
				if (message.guild) {
					messageData?.insertOne({
						channelAndMessageIds: messageDataObj,
						timestamp: message.createdTimestamp,
						authorId: message.author.id,
						serverId: message.guild?.id,
						reference: message.reference,
						expired: false,
					});
				}
			})
			.catch(logger.error);

	},
};