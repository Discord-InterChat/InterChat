import { Message } from 'discord.js';
import { Collection } from 'mongodb';
import { connectedListDocument } from '../../Utils/typings/types';
import logger from '../../Utils/logger';


export interface InvalidChannelId {unknownChannelId?: string}

export default {
	execute: async (message: Message, channelAndMessageIds: Promise<Message | InvalidChannelId>[], messageData: Collection | undefined, connectedList: Collection<connectedListDocument> | undefined) => {
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

				// make a new array with data that contains the message id and channel id
				// required for performing network actions (delete/edit messages)
				const messageDataObj = fulfilledResults
					.filter(msg => msg.value.channelId && msg.value.id)
					.map((msg: PromiseFulfilledResult<Message>) => {return { channelId: msg.value.channelId, messageId: msg.value.id };});


				// delete invalid channels from the database
				connectedList?.deleteMany({ channelId: { $in: invalidChannelIds } });


				// for editing and deleting messages
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