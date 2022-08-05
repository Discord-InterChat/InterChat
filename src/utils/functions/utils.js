const logger = require('../logger');
const { MongoClient, Db } = require('mongodb');
const { resolveColor, Message, ContextMenuCommandInteraction, ChatInputCommandInteraction, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction, Client, ChannelType, Guild } = require('discord.js');
const { Api } = require('@top-gg/sdk');
require('dotenv').config();


const topgg = new Api(process.env.TOPGG);
const uri = process.env.MONGODB_URI;
let _db;


module.exports = {
	/**
	 *
	 * @param {'random'|'chatbot'|'invisible'|undefined} type
	 */
	colors: (type = 'random') => {
		const colorType = {
			random: [
				'Default',
				'White',
				'Aqua',
				'Green',
				'Blue',
				'Yellow',
				'Purple',
				'LuminousVividPink',
				'Fuchsia',
				'Gold',
				'Orange',
				'Red',
				'Grey',
				'DarkNavy',
				'DarkAqua',
				'DarkGreen',
				'DarkBlue',
				'DarkPurple',
				'DarkVividPink',
				'DarkGold',
				'DarkOrange',
				'DarkRed',
				'DarkGrey',
				'DarkerGrey',
				'LightGrey',
				'DarkNavy',
				'Blurple',
				'Greyple',
				'DarkButNotBlack',
				'NotQuiteBlack',
				'Random',
			],
			chatbot: '#5CB5F9',
			invisible: '#2F3136',
		};

		// return the color type or a random color from the list
		return type === 'chatbot' ? colorType.chatbot : type === 'invisible' ? colorType.invisible :
			module.exports.choice(colorType.random);
	},
	choice: (arr) => {
		return resolveColor(arr[Math.floor(Math.random() * arr.length)]);
	},

	/**
	 * Send a message to a guild
	 * @param {Guild} guild
	 * @param {Message} message
	 */
	sendInFirst: async (guild, message) => {
		const channels = await guild.channels.fetch();
		for (const channel of channels) {
			if (channel[1].type == ChannelType.GuildText) {
				if (channel[1].permissionsFor(guild.members.me).has('SendMessages')) {
					try {
						await channel[1].send(message);
						break;
					}
					catch (err) {
						logger.error(err);
					}
				}
			}
		}
	},

	topgg: topgg,
	developers: [
		736482645931720765n,
		828492978716409856n,
		748190663597883392n,
		701727675311587358n,
		827745783964499978n,
	],
	staff: [442653948630007808n, 336159680244219905n],
	mainGuilds: {
		cbhq: '770256165300338709',
		cbTest: '969920027421732874',
		botTest: '818348790435020810',
	},

	getCredits: async () => {
		let creditArray = [];

		creditArray = creditArray.concat(module.exports.developers, module.exports.staff);

		return creditArray;
	},

	connect: callback => {
		MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
			_db = client.db('Discord-ChatBot');
			return callback(err);
		});
	},
	/**
	 * Returns the database
	 * @returns {Db}
	 */
	getDb: () => {
		return _db;
	},

	toHuman: (milliseconds) => {
		let totalSeconds = milliseconds / 1000;
		const days = Math.floor(totalSeconds / 86400);
		totalSeconds %= 86400;
		const hours = Math.floor(totalSeconds / 3600);
		totalSeconds %= 3600;
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds % 60);
		let uptime;

		if (days == 0 && hours == 0 && minutes == 0) uptime = `${seconds} seconds`;
		else if (days == 0 && hours == 0) uptime = `${minutes}m ${seconds}s`;
		else if (days == 0) uptime = `${hours}h, ${minutes}m ${seconds}s`;
		else uptime = `${days}d ${hours}h, ${minutes}m ${seconds}s`;

		return uptime;
	},

	/**
	 *
	 * @param {ChatInputCommandInteraction|MessageContextMenuCommandInteraction|UserContextMenuCommandInteraction} interaction
	 * @param {boolean} onlyDeveloper
	 * @returns
	 */
	checkIfStaff: async (interaction, onlyDeveloper = false) => {
		try {
			const staff = '800698916995203104';
			const developers = '770256273488347176';

			const guild = await interaction.client.guilds.fetch('770256165300338709');
			const member = await guild.members.fetch(interaction.user.id);
			const roles = member.guild.roles.cache;
			let verification = 0;

			if (onlyDeveloper === true && roles?.has(developers)) return (verification = 1);

			if (roles?.has(developers) || roles?.has(staff)) {
				verification = 1;
			}
			else {
				await interaction.reply({
					content: 'You do not have permissions to run this command!',
					ephemeral: true,
				});
			}
			return verification;
		}
		catch (e) {
			await interaction.reply({
				content: 'You do not have permissions to run this command!',
				ephemeral: true,
			});
			return 0;
		}
	},

	/**
	 *
	 * @param {Client} client
	 * @param {string} text
	 * @returns
	 */
	clean: async (client, text) => {
		// If our input is a promise, await it before continuing
		if (text && text.constructor.name == 'Promise') text = await text;

		// If the response isn't a string, `util.inspect()`
		// is used to 'stringify' the code in a safe way that
		// won't error out on objects with circular references
		// (like Collections, for example)
		if (typeof text !== 'string') text = require('util').inspect(text, { depth: 1 });

		// Replace symbols with character code alternatives
		text = text
			.replace(/`/g, '`' + String.fromCharCode(8203))
			.replace(/@/g, '@' + String.fromCharCode(8203));

		const redact = '\u001B[38;5;31m[REDACTED]\u001B[0m';
		const mongoRegex = /mongodb\+srv:\/\/737:.*|mongodb:\/\/737:.*/g;

		text = text.replaceAll(client.token, redact);
		text = text.replaceAll(process.env.TOPGG, redact);
		text = text.replace(mongoRegex, redact);
		// Send off the cleaned up result
		return text;
	},

	/**
	 * Delete channels that chatbot doesn't have access to.
	 * @param {Client} client
	 * @returns
	 */
	deleteChannels: async (client) => {
		const database = _db;
		const connectedList = database.collection('connectedList');
		const channels = await connectedList.find().toArray();

		const unknownChannels = [];
		for (let i = 0; i < channels.length; i++) {
			const element = channels[i];
			try {
				await client.channels.fetch(element.channelId);
			}
			catch (e) {
				if (e.message === 'Unknown Channel') {
					unknownChannels.push(element.channelId);
					continue;
				}
			}
		}

		if (unknownChannels.length > 0) {
			const deleteCursor = await connectedList.deleteMany({
				channelId: { $in: unknownChannels },
			});
			return logger.info(
				`Deleted ${deleteCursor.deletedCount} channels from the connectedList database.`,
			);
		}
	},

	/**
	 * @param {ChatInputCommandInteraction | ContextMenuCommandInteraction | Message} interaction
	 * @param {String} message
	 */
	sendInNetwork: async (interaction, message) => {
		const database = _db;
		const connectedList = database.collection('connectedList');
		const channels = await connectedList.find().toArray();

		await channels.forEach((channelEntry) => {
			interaction.client.channels.fetch(channelEntry.channelId).then(async (channel) => {
				await channel.send(message);
			});
		});
	},
};

// This works directly on strings, no need to import (eg: 'string'.toTitleCase() )
String.prototype.toTitleCase = function() {
	let upper = true;
	let newStr = '';
	for (let i = 0, l = this.length; i < l; i++) {
		if (this[i] == ' ') {
			upper = true;
			newStr += this[i];
			continue;
		}
		newStr += upper ? this[i].toUpperCase() : this[i].toLowerCase();
		upper = false;
	}
	return String(newStr);
};
