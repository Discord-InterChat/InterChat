import { Message, User } from 'discord.js';
import { blacklistsMap, usersMap, warningsMap } from '../../Events/messageCreate';
import { constants } from '../../Utils/functions/utils';

const LIMIT = 3;
const TIME = 60_000;
const DIFF = 2000;
const CHAR_REGEX = /(.)\1{15,}/g;
const MAX_WARNS = 5;

interface blacklistOptions {
	reason: string;
	duration?: number;
}

async function addToBlacklist(user: User, options: blacklistOptions) {
	clearTimeout(usersMap.get(user.id)?.timer);
	usersMap.delete(user.id);

	const duration = options.duration || 60 * 5000;

	if (options.duration) {
		clearTimeout(warningsMap.get(user.id)?.timer);
		const userWarnings = warningsMap.get(user.id);

		warningsMap.set(user.id, {
			warnCount: userWarnings ? userWarnings.warnCount + 1 : 1,
			timer: setTimeout(() => warningsMap.delete(user.id), TIME),
		});
	}
	return blacklistsMap.set(user.id, {
		user: user,
		timer: setTimeout(() => {
			blacklistsMap.delete(user.id);
		}, duration),
	});
}

export = {
	/** Basic anti-spam that I found online, with my own tweaks.*/
	async execute(message: Message) {
		const repeatedChar = CHAR_REGEX.test(message.content);
		if (repeatedChar) {
			addToBlacklist(message.author, { reason: 'Charecter Spam.' });
			message.channel.send('You are blacklisted for spamming charecters.');
			return true;
		}

		if (usersMap.has(message.author.id)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const userSpamData = usersMap.get(message.author.id)!;
			const userWarnings = warningsMap.get(message.author.id);

			// eslint-disable-next-line prefer-const
			let { lastMessage, timer, msgCount, slowMsgCount } = userSpamData;

			const difference = message.createdTimestamp - lastMessage.createdTimestamp;

			console.log(`lastMessage: ${lastMessage}, timer: ${timer}, msgCount: ${msgCount}, slowMsgCount: ${slowMsgCount}`);


			if (userWarnings && userWarnings?.warnCount >= MAX_WARNS) {
				const logChannel = message.client.channels.cache.get(constants.channel.chatbotlogs);
				if (logChannel?.isTextBased()) logChannel.send(`${message.client.emoji.normal.no} **User ${message.author.tag} (${message.author.id}) has been blacklisted for 30 minutes for ${MAX_WARNS} consecutive warnings related to spamming.**`);
				addToBlacklist(message.author, { reason: 'More than 5 warns in a minute', duration: 60 * 60 * 500 });
				return;
			}

			// If messages are too short and are sent in an interval of more than 2 seconds
			if (difference > DIFF) {
				++slowMsgCount;
				if (message.content == lastMessage.content && slowMsgCount === LIMIT) {
					addToBlacklist(message.author, { reason: 'Detected Slow Message spam.' });
					message.channel.send('You have been blacklisted for spamming.');
					return true;
				}

				// Short message detection
				if (message.content.length < 3 && lastMessage.content.length < 3 && slowMsgCount === LIMIT) {
					addToBlacklist(message.author, { reason: 'Detected short messages consecutively.' });
					message.channel.send(`${message.author} Please keep your messages longer than two charecters. You can send your next message in 5 minutes.`);
					return true;
				}


				clearTimeout(timer);
				userSpamData.msgCount = msgCount >= LIMIT ? msgCount = 1 : msgCount;
				userSpamData.lastMessage = message;
				userSpamData.slowMsgCount = slowMsgCount >= LIMIT ? slowMsgCount = 1 : slowMsgCount;
				userSpamData.timer = setTimeout(() => usersMap.delete(message.author.id), TIME);
				usersMap.set(message.author.id, userSpamData);
			}

			else {
				++msgCount;
				if (msgCount === LIMIT) {
					addToBlacklist(message.author, { reason: 'Fast Message spam.', duration: userWarnings && userWarnings.warnCount >= MAX_WARNS ? undefined : 5000 });
					message.channel.send(`${message.author} Please slow down.`);
					return true;
				}

				if (message.content.length < 3 && lastMessage.content.length < 3 && difference < 1000) {
					addToBlacklist(message.author, { reason: 'Short messages in a short amount of time.', duration: userWarnings && userWarnings.warnCount >= MAX_WARNS ? undefined : 5000 });
					message.channel.send(`${message.author} Warning: Spamming in the network is forbidden!`);
					return true;
				}

				if (message.content.length > 1000 && msgCount > 2) {
					addToBlacklist(message.author, { reason: 'Long message spam.', duration: userWarnings && userWarnings.warnCount >= MAX_WARNS ? undefined : 5000 });
					message.channel.send(`${message.author} I have detected long message spam. Please slow down.`);
					return true;
				}
				// short message detection
				else {
					userSpamData.msgCount = msgCount;
					userSpamData.slowMsgCount = slowMsgCount >= LIMIT ? slowMsgCount = 1 : slowMsgCount;
					usersMap.set(message.author.id, userSpamData);
				}
			}
		}
		else {
			const fn = setTimeout(() => usersMap.delete(message.author.id), TIME);
			usersMap.set(message.author.id, {
				msgCount: 1,
				slowMsgCount: 1,
				lastMessage : message,
				timer : fn,
			});
		}

		// true = spam, false = not spam
		return false;
	},
};