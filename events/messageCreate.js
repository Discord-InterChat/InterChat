/* eslint-disable no-inline-comments */
const { EmbedBuilder, Message } = require('discord.js');
const logger = require('../logger');
const { getDb, colors, developers, clean } = require('../utils');
const { client } = require('../index');
const { messageTypes } = require('../scripts/message/messageTypes');
const wordFilter = require('../scripts/message/wordFilter');
const emoji = require('../emoji.json');

// TODO Replace bad-words with leo-profanity as it provides the entire list of bad words it uses.
const Filter = require('bad-words'),
	filter = new Filter();

module.exports = {
	name: 'messageCreate',
	/**
	 * @param {Message} message
	 * @returns
	 */
	async execute(message) {
		if (message.author.bot) return;

		// The actual eval command
		if (message.content.startsWith('c!eval')) {
			message.content = message.content.replace(/```js|```/g, '');

			// Get our input arguments
			const args = message.content.split(' ').slice(1);

			// If the message author's ID does not equal
			// our ownerID, get outta there!
			// eslint-disable-next-line no-undef
			if (!developers.includes(BigInt(message.author.id))) return;

			// In case something fails, we to catch errors
			// in a try/catch block
			try {
				// Evaluate (execute) our input
				const evaled = eval(args.join(' '));

				// Put our eval result through the function
				// we defined above
				const cleaned = await clean(client, evaled);


				// create a new embed
				const embed = new EmbedBuilder()
					.setColor('BLURPLE')
					.setTitle('Evaluation')
					.setFields([
						{ name: 'Input', value: `\`\`\`js\n${args.join(' ')}\n\`\`\`` },
						{ name: 'Output', value: `\`\`\`js\n${cleaned}\n\`\`\`` },
					])
					.setTimestamp();

				// if cleaned includes [REDACTED] then send a colored codeblock
				if (cleaned.includes('[REDACTED]')) embed.spliceFields(1, 1, { name: 'Output', value:  `\`\`\`ansi\n${cleaned}\n\`\`\` ` });


				if (embed.length > 6000) return message.reply('Output too long to send. Logged to console. Check log file for more info.');

				// Reply in the channel with our result
				message.channel.send({ embeds: [embed] });
			}
			catch (err) {
				// Reply in the channel with our error
				message.channel.send(`\`ERROR\` \`\`\`xl\n${err}\n\`\`\``);
			}

			// End of our command
		}

		if (message.content.startsWith('c!help') || message.content.startsWith('c!connect') || message.content.startsWith('c!disconnect')) {
			await message.reply('ChatBot does not respond to any commands with the prefix `c!` anymore since we have switched to slash commands! Please type / and check out the list of commands!');
			return;
		}

		// main db where ALL connected channel data is stored
		const database = getDb();
		const connectedList = database.collection('connectedList');

		// db for setup data
		const setup = database.collection('setup');
		const channelInNetwork = await connectedList.findOne({ channelId: message.channel.id });

		// db for blacklisted users
		const blacklistedUsers = database.collection('blacklistedUsers');
		const userInBlacklist = await blacklistedUsers.findOne({ userId: message.author.id });

		// db for blacklisted words
		const restrictedWords = database.collection('restrictedWords');
		const wordList = await restrictedWords.findOne({ name: 'blacklistedWords' });

		// db for anti-spam
		// const spamcollection = database.collection('message');


		// Checks if channel is in databse, rename maybe?
		if (channelInNetwork) {
			/*
			FIXME: Make a better spam filter, this makes it slow
			const messageid = message.id;
			const userid = message.author.id;
			const usermessages = await spamcollection.find({ 'user.id': userid }).toArray();

			spamcollection.insertOne({
				user: {
					name: message.author.tag,
					id: message.author.id,
				},
				message: {
					id: message.id,
					content: message.content,
				},
				channel: {
					name: message.channel.name,
					id: message.id,
				},
				guild: {
					name: message.guild.name,
					id: message.guild.id,
				},
				timestamp: message.createdTimestamp,
			}).then(() => setInterval(() => { spamcollection.deleteOne({ 'message.id': messageid }); }, 3000));

			if (usermessages.length > 1) {
				return message.react(emoji.normal.no).catch(() => {return;});
			}

			if (usermessages.length > 6) {
				message.channel.send(emoji.icons.exclamation + ' **I have disconnected this channel from the network as I have detected heavy spam.**');
				return connectedList.deleteOne({ channelId: message.channel.id });
			} */

			if (message.content.includes('discord.gg') || message.content.includes('discord.com/invite')) {
				return message.react(emoji.normal.no);
			}

			// TODO: Warning and timed blacklist system
			// blacklist a user for a specific amount of time if they have over x warns
			// might come in handy in other cases too.

			if (userInBlacklist) {
				// if user is in blacklist and Notified is false, send them a message saying they are blacklisted
				if (!userInBlacklist.notified) {
					message.author.send(`You are blacklisted from using this bot for reason **${userInBlacklist.reason}**. Please join the support server and contact the staff to try and get whitelisted and/or if you think the reason is not valid.`);
					blacklistedUsers.updateOne({ userId: message.author.id }, { $set: { notified: true } });
				}
				return;
			}

			// check if message contains slurs
			if (message.content.toLowerCase().includes(wordList.words[0]) || message.content.toLowerCase().includes(wordList.words[1]) || message.content.toLowerCase().includes(wordList.words[2])) {
				await wordFilter.log(message);
				return;
			}


			/*
			 TODO:
			 if message contains profanity execute script
			 edit the embed instead of changing the message content
			 if guild has profanity disabled and has embeds on set the embed to normal desc :DDDDDDDDDDDDD
			*/


			// check if message contains profanity
			if (filter.isProfane(message.content)) message.content = wordFilter.censor(message);
			// dont send message if guild name is inappropriate
			if (filter.isProfane(message.guild.name)) return message.channel.send('I have detected words in the server name that are potentially offensive, Please fix them before using this chat!');

			const allConnectedChannels = await connectedList.find();

			const embed = new EmbedBuilder()
				.setTimestamp()
				.setColor(colors())
				.setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL({ dynamic: true }), url: `https://discord.com/users/${message.author.id}` })
				.setFooter({ text: `From: ${message.guild}┃${message.guild.id}`, iconURL: message.guild.iconURL({ dynamic: true }) })
				.addFields([
					{ name: 'Message', value: message.content || '\u200B', inline: false }]);

			await require('../scripts/message/addBadges').execute(message, database, embed);
			await require('../scripts/message/messageContentModifiers').execute(message, embed);


			// delete the message only if it doesn't contain images
			if (message.attachments.first() === undefined) {
				try {await message.delete();}
				catch (err) {logger.warn(err + ' cannot delete message');}
			}
			const deletedChannels = [];

			// NOTE: Using the db used here in other chatbot's will end up deleting all servers when you send a message... so be careful XD
			allConnectedChannels.forEach(async channelObj => {
				try {
					await client.channels.fetch(channelObj.channelId);
				}
				catch {
					logger.warn(`Deleting non-existant channel ${channelObj.channelId} from database.`);

					deletedChannels.push(channelObj.channelId);

					// REVIEW: I have a feeling that this runs multiple times and only deletes 1 at a time...
					await connectedList.deleteMany({ channelId: { $in: deletedChannels } });

					// deleting the channels that was pushed to deletedChannels earlier, from the databse
					await setup.deleteMany({ 'channel.id': { $in: deletedChannels } }); // NOTE: $in only takes array

					return;
				}
				await messageTypes(client, message, channelObj, embed, setup);

			});
		}
		else {
			return;
		}
	},
};