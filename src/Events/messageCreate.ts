import wordFilter from '../Utils/functions/wordFilter';
import logger from '../Utils/logger';
import messageContentModifiers from '../Scripts/message/messageContentModifiers';
import evalScript from '../Scripts/message/evalScript';
import messageTypes from '../Scripts/message/messageTypes';
import { EmbedBuilder, Message } from 'discord.js';
import { getDb, colors } from '../Utils/functions/utils';
import { connectedListDocument } from '../Utils/typings/types';

// TODO: edit the embed instead of changing the message content
// if guild has profanity disabled and has embeds on set the embed to normal desc :DDDDDDDDDDDDD

// TODO: Warning and timed blacklist system
// blacklist a user for a specific amount of time if they have over x warns
// might come in handy in other cases too.


export default {
	name: 'messageCreate',
	async execute(message: Message) {
		if (message.author.bot) return;
		// FIXME c! on main cb
		if (message.content.startsWith('cb!eval')) evalScript.execute(message);

		// main db where ALL connected channel data is stored
		const database = getDb();
		const connectedList = database?.collection('connectedList');

		// db for setup data
		const setup = database?.collection('setup');
		const channelInNetwork = await connectedList?.findOne({ channelId: message.channel.id });

		const messageData = database?.collection('messageData');

		if (channelInNetwork) {
			const checks = await require('../Scripts/message/checks').execute(message, database);
			if (checks === false) return;

			if (message.reference) {
				const referredMessage = await message.fetchReference();
				if (referredMessage.author.id === message.client.user.id
					&& referredMessage.embeds
					&& referredMessage.embeds[0].fields?.length > 0
				) {
					message.content = `> ${referredMessage.embeds[0]?.fields[0]?.value}\n${message.content}`;
				}
			}

			// check if message contains profanity and censor it if it does
			if (wordFilter.check(message.content)) message.content = wordFilter.censor(message.content);

			const allConnectedChannels = await connectedList?.find().toArray();

			const embed = new EmbedBuilder()
				.setTimestamp()
				.setColor(colors())
				.addFields([{
					name: 'Message',
					value: message.content || '\u200B',
					inline: false,
				}])
				.setAuthor({
					name: message.author.tag,
					iconURL: message.author.avatarURL()?.toString(),
					url: `https://discord.com/users/${message.author.id}`,
				})
				.setFooter({
					text: `From: ${message.guild}┃${message.guild?.id}`,
					iconURL: message.guild?.iconURL()?.toString(),
				});

			await require('../Scripts/message/addBadges').execute(message, database, embed);
			await messageContentModifiers.execute(message, embed);

			const attachments = await messageContentModifiers.attachmentModifiers(message, embed);

			// leveling system
			require('../Scripts/message/levelling').execute(message);

			const channelAndMessageIds: Promise<Message<boolean> | undefined>[] = [];
			const channelsToDelete: string[] = [];

			for (const channelObj of allConnectedChannels as connectedListDocument[]) {
				try {
					await message.client.channels.fetch(channelObj.channelId);
				}
				catch {
					channelsToDelete.push(channelObj.channelId);
					logger.warn(`Found deleted channel ${channelObj.channelId} in database.`);
					continue;
				}

				// sending the messages to the connected channels
				const msg = messageTypes.execute(message.client, message, channelObj, embed, setup, attachments);
				// push the entire promise, as we dont want to wait for it inside the loop
				channelAndMessageIds.push(msg);
			}

			message.delete().catch(() => {return;});

			// TODO make a cleanup script for after message is sent
			connectedList?.deleteMany({ channelId: { $in: channelsToDelete } });
			setup?.deleteMany({ 'channel.id': { $in: channelsToDelete } });


			Promise.allSettled(channelAndMessageIds)
				.then((data) => {
					const messageDataObj = data.map((msg) => {
						if (msg.status === 'fulfilled') return { channelId: msg.value?.channelId, messageId: msg.value?.id };
					});

					// for editing and deleting messages
					messageData?.insertOne({
						channelAndMessageIds: messageDataObj,
						timestamp: message.createdTimestamp,
						authorId: message.author.id,
						serverId: message.guild?.id,
					});
				})
				.catch((e) => {
					logger.error(e);
				});


		}
		else {
			return;
		}
	},
};
