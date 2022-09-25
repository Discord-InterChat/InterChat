import { GuildMember, Message, User } from 'discord.js';

const LIMIT = 4;
const TIME = 60_000;
const DIFF = 2000;
const CHAR_REGEX = /(.)\1{9,}/g;

type BlacklistEntries = {
	user: GuildMember | User,
	timer: NodeJS.Timeout
}

type UserEntries = {
	msgCount: number,
	slowMsgCount: number,
	lastMessage : Message,
	timer : NodeJS.Timeout,
}


function blacklistUser(user: GuildMember|User, map: Map<string, BlacklistEntries>) {
	map.set(user.id, {
		user: user,
		timer: setTimeout(() => {
			map.delete(user.id);
			console.log('Removed from blacklist');
		}, 3000), // TIME),
	});
}

export = {
	/**
	 * Basic anti-spam that I got from youtube and StackOverflow, with my own tweaks.
	*/
	async execute(message: Message, blacklistsMap: Map<string, BlacklistEntries>, usersMap: Map<string, UserEntries>) {
		// true = spam, false = not spam
		let returnValue = false;

		const repeatedChar = CHAR_REGEX.test(message.content);
		if (repeatedChar) {
			message.channel.send('You are blacklisted for spamming charecters.');
			blacklistUser(message.author, blacklistsMap);
			returnValue = true;
		}

		if (usersMap.has(message.author.id)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const userData = usersMap.get(message.author.id)!;

			let { lastMessage, timer, msgCount, slowMsgCount } = userData; // eslint-disable-line prefer-const
			const difference = message.createdTimestamp - lastMessage.createdTimestamp;

			if (difference > DIFF) {
				console.log(`slowMsgCount = ${slowMsgCount}`, slowMsgCount === LIMIT);

				if (message.content === lastMessage.content && slowMsgCount === LIMIT) {
					message.channel.send('You are blacklisted for spamming');
					blacklistUser(message.author, blacklistsMap);
					slowMsgCount = 1;
					returnValue = true;
				}

				if (message.content.length < 3 && slowMsgCount === LIMIT) {
					message.channel.send('Message is too short and user has reached the limit');
					returnValue = true;
				}


				clearTimeout(timer);
				console.log('Cleared Timeout');
				userData.msgCount = 1;
				userData.lastMessage = message;
				userData.slowMsgCount = slowMsgCount > 4 ? slowMsgCount = 1 : ++slowMsgCount;
				userData.timer = setTimeout(() => {
					usersMap.delete(message.author.id);
					console.log('Removed from map.');
				}, TIME);
				usersMap.set(message.author.id, userData);
			}
			else {
				++msgCount;
				console.log(msgCount, difference);
				if (msgCount === LIMIT) {
					message.channel.send(message.author.toString() + 'Warning: Spamming in this channel is forbidden.');
					// message.channel.bulkDelete(LIMIT);
					blacklistUser(message.author, blacklistsMap);
					returnValue = true;
				}

				if (message.content.length < 3 && difference < 1000 && lastMessage.content.length < 3) {
					message.channel.send('Message is too short and difference is less than 700ms');
				}

				if (message.content.length > 500 && msgCount === 2) {
					message.channel.send('Long messages are not allowed.');
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
			const fn = setTimeout(() => {
				usersMap.delete(message.author.id);
				console.log('Removed from map.');
			}, TIME);
			usersMap.set(message.author.id, {
				msgCount: 1,
				slowMsgCount: 1,
				lastMessage : message,
				timer : fn,
			});
		}
		console.log(`${returnValue ? 'Spam' : 'Not spam'} detected.`);
		return returnValue;
	},
};