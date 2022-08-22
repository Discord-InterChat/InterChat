const logger = require('../logger');
const discord = require('discord.js');
const { MongoClient, Db } = require('mongodb');
const { Api } = require('@top-gg/sdk');
require('dotenv').config();


const topgg = new Api(process.env.TOPGG);
const uri = process.env.MONGODB_URI;
let _db;

module.exports = {
	/**
	 * Random color generator for embeds
	 * @param {'random'|'chatbot'|'invisible'} [type]
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
	/**
	 * Returns random color (resolved) from choice of Discord.JS default color string
	 * @param {string[]} arr
	 */
	choice: (arr) => {
		return discord.resolveColor(arr[Math.floor(Math.random() * arr.length)]);
	},

	/**
	 * Send a message to a guild
	 * @param {discord.Guild} guild
	 */
	sendInFirst: async (guild, message) => {
		const channels = await guild.channels.fetch();
		for (const channel of channels) {
			if (channel[1].type == discord.ChannelType.GuildText) {
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

	topgg,

	developers: [
		736482645931720765n,
		828492978716409856n,
		748190663597883392n,
		701727675311587358n,
		827745783964499978n,
	],
	staff: [
		442653948630007808n,
		336159680244219905n,
	],
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

	/**
	 * Convert milliseconds to a human readable time (eg: 1d 2h 3m 4s)
	 * @param {number} milliseconds
	 * @returns {string}
	 */
	toHuman: (milliseconds) => {
		let totalSeconds = milliseconds / 1000;
		const days = Math.floor(totalSeconds / 86400);
		totalSeconds %= 86400;
		const hours = Math.floor(totalSeconds / 3600);
		totalSeconds %= 3600;
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds % 60);
		let readable;

		if (days == 0 && hours == 0 && minutes == 0) readable = `${seconds} seconds`;
		else if (days == 0 && hours == 0) readable = `${minutes}m ${seconds}s`;
		else if (days == 0) readable = `${hours}h, ${minutes}m ${seconds}s`;
		else readable = `${days}d ${hours}h, ${minutes}m ${seconds}s`;

		return readable;
	},

	/**
	 * @param {discord.Client} client
	 * @param {discord.GuildMember|discord.User} user
	 * @param {boolean} onlyDeveloper
	 */
	checkIfStaff: async (client, user, onlyDeveloper = false) => {
		try {
			const staff = '800698916995203104';
			const developers = '770256273488347176';

			const allowedRoles = [staff, developers];

			const guild = await client.guilds.fetch('770256165300338709');
			const member = await guild.members.fetch(user);
			const roles = member.roles.cache;

			const isStaff = roles?.hasAny(...allowedRoles);
			const isDev = roles?.has(developers);

			if (onlyDeveloper && isDev) return true;
			else if (isStaff) return true;
			return false;
		}
		catch (e) {
			return false;
		}
	},

	/**
	 *
	 * @param {discord.Client} client
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
	 * @param {discord.Client} client
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
			logger.info(`Deleted ${deleteCursor.deletedCount} channels from the connectedList database.`);
			return;
		}
	},

	/**
	 * @param {discord.ChatInputCommandInteraction | discord.ContextMenuCommandInteraction | discord.Message} interaction
	 * @param {String} message
	 */
	sendInNetwork: async (interaction, message) => {
		const database = _db;
		const connectedList = database.collection('connectedList');
		const channels = await connectedList.find().toArray();

		await channels.forEach((channelEntry) => {
			interaction.client.channels.fetch(channelEntry.channelId)
				.then(async (channel) => await channel.send(message));
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