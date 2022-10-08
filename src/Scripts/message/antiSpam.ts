import { GuildMember, Message, User } from 'discord.js';
import { blacklistsMap, usersMap } from '../../Events/messageCreate';

const LIMIT = 3;
const TIME = 60_000;
const DIFF = 1500;
const CHAR_REGEX = /(.)\1{15,}/g;


function addToBlacklist(user: GuildMember|User, duration = 5000) {
	blacklistsMap.set(user.id, {
		user: user,
		timer: setTimeout(() => {
			blacklistsMap.delete(user.id);
		}, duration),
	});
	usersMap.delete(user.id);
}

export = {
	/** Basic anti-spam that I found online, with my own tweaks.*/
	async execute(message: Message) {
		// true = spam, false = not spam
		let returnValue = false;

		const repeatedChar = CHAR_REGEX.test(message.content);
		if (repeatedChar) {
			addToBlacklist(message.author);
			message.channel.send('You are blacklisted for spamming charecters.');
			return true;
		}

		if (usersMap.has(message.author.id)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const userData = usersMap.get(message.author.id)!;

			// eslint-disable-next-line prefer-const
			let { lastMessage, timer, msgCount, slowMsgCount } = userData;
			const difference = message.createdTimestamp - lastMessage.createdTimestamp;


			// If messages are too short and are sent in an interval of more than 2 seconds
			if (difference > DIFF) {

				if (message.content === lastMessage.content && slowMsgCount === LIMIT) {
					addToBlacklist(message.author);
					message.channel.send('You have been blacklisted for spamming.');
					slowMsgCount = 1;
					return true;
				}

				// Short message detection
				if (message.content.length <= 4 && slowMsgCount === LIMIT) {
					addToBlacklist(message.author);
					message.channel.send(`${message.author} You have been blacklisted for spmmaing!`);
				}


				clearTimeout(timer);
				userData.msgCount = 1;
				userData.lastMessage = message;
				userData.slowMsgCount = slowMsgCount > 4 ? slowMsgCount = 1 : ++slowMsgCount;
				userData.timer = setTimeout(() => {
					usersMap.delete(message.author.id);
				}, TIME);
				usersMap.set(message.author.id, userData);
			}

			else {
				++msgCount;
				if (msgCount === LIMIT) {
					addToBlacklist(message.author, 10_00);
					message.channel.send(`${message.author} Warning: Spamming in this channel is forbidden.`);
					return true;
				}

				if (message.content.length < 3 && difference < 1000 && lastMessage.content.length < 3) {
					addToBlacklist(message.author);
					message.channel.send(`${message.author} Warning: Spamming in the network is forbidden.`);
					return true;
				}

				if (message.content.length > 1000 && msgCount > 2) {
					message.channel.send(`${message.author} I have detected long message spam. Please slow down.`);
					returnValue = true;
				}
				// short message detection
				else {
					userData.msgCount = msgCount;
					userData.slowMsgCount = slowMsgCount >= LIMIT ? slowMsgCount = 1 : slowMsgCount;
					usersMap.set(message.author.id, userData);
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
		return returnValue;
	},
};