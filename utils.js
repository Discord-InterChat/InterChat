const logger = require('./logger');
const dotenv = require('dotenv');
const emoji = require('./emoji.json');
const { MongoClient } = require('mongodb');
const { ActionRowBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonStyle, ButtonBuilder } = require('discord.js');
const { Api } = require('@top-gg/sdk');
dotenv.config();

const topgg = new Api(process.env.TOPGG);
const uri = process.env.MONGODB_URI;
let _db;


module.exports = {
	topgg: topgg,

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
		};

		return type === 'chatbot' ? colorType.chatbot : module.exports.choice(colorType.random);
	},
	choice: (arr) => {
		return arr[Math.floor(Math.random() * arr.length)];
	},
	// Example: 'string'.toTitleCase()
	toTitleCase: function() {
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
	},
	sendInFirst: async (guild, message) => {
		const channels = await guild.channels.fetch();
		for (const channel of channels) {
			if (channel[1].type == 'GUILD_TEXT') {
				if (channel[1].permissionsFor(guild.me).has('SEND_MESSAGES')) {
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
	developers: [736482645931720765n, 828492978716409856n, 748190663597883392n, 701727675311587358n, 827745783964499978n], // makiyu, nik, genz, dev, supreme 828492978716409856n, 701727675311587358n, 526616688091987968n, 336159680244219905n, 808168843352080394n, 736482645931720765n
	staff: [442653948630007808n, 336159680244219905n],
	cbhq: '770256165300338709',

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
	getDb: () => {
		return _db;
	},

	toHuman: (client) => {
		let totalSeconds = (client.uptime / 1000);
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

	staffPermissions: async (interaction) => {
		try {
			const staff = '800698916995203104';
			const developers = '770256273488347176';

			const guild = await interaction.client.guilds.fetch('770256165300338709');
			const member = await guild.members.fetch(interaction.user.id);
			const roles = member._roles;
			let verification = 0;

			if (roles?.includes(developers) || roles?.includes(staff)) {
				verification = 1;
			}
			else {
				await interaction.reply({ content: 'You do not have permissions to run this command!', ephemeral: true });
			}
			return verification;
		}
		catch (e) {
			logger.error(e);
			await interaction.reply({ content: 'You do not have permissions to run this command!', ephemeral: true });
			return 0;
		}
	},

	/**
	 * @param {ChatInputCommandInteraction} interaction
	 * @param {EmbedBuilder[]} pages
	 * @param {Number} time
	 * @param {Object} emojis
	 */
	paginate: async (interaction, pages, emojis, time = 60000) => {
		if (!typeof emojis === Object) throw new Error('emojis must be an object containing: next, exit, back');
		if (!interaction || !pages || !(pages?.length > 0) || !(time > 10000)) throw new Error('Invalid Parameters');

		// eslint-disable-next-line prefer-const
		let index = 0, row = new ActionRowBuilder().addComponents([
			new ButtonBuilder().setEmoji(emojis?.back || emoji.icons.back).setCustomId('1').setStyle(ButtonStyle.Secondary).setDisabled(true),
			new ButtonBuilder().setEmoji(emojis?.exit || emoji.icons.delete).setCustomId('3').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setEmoji(emojis?.next || emoji.icons.next).setCustomId('2').setStyle(ButtonStyle.Secondary).setDisabled(pages.length <= index + 1),
		]);

		let pagenumber = 0;
		try {
			pages[pagenumber].setFooter({ text: `Page ${pagenumber + 1} / ${pages.length}` });
		}
		catch {/**/}

		const data = {
			embeds: [pages[index]],
			components: [row],
			fetchReply: true,
		};
		const msg = interaction.replied ? await interaction.followUp(data) : await interaction.reply(data);

		const col = msg.createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id,
			time: 60000,
		});

		col.on('collect', (i) => {
			if (i.customId === '1') --pagenumber, index--;
			else if (i.customId === '2') pagenumber++, index++;
			else col.stop();


			row.setComponents([
				new ButtonBuilder().setEmoji(emojis?.back || emoji.icons.back).setStyle(ButtonStyle.Secondary).setCustomId('1').setDisabled(index === 0),
				new ButtonBuilder().setEmoji(emojis?.exit || emoji.icons.delete).setStyle(ButtonStyle.Danger).setCustomId('3'),
				new ButtonBuilder().setEmoji(emojis?.next || emoji.icons.next).setStyle(ButtonStyle.Secondary).setCustomId('2').setDisabled(index === pages.length - 1),
			]);

			try {pages[pagenumber].setFooter({ text: `Page ${pagenumber + 1} / ${pages.length}` });}
			catch {/**/}

			i.update({
				components: [row],
				embeds: [pages[index]],
			});

			col.on('end', () => {
				msg.edit({
					components: [],
				});
			});
		});
	},
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
};
String.prototype.toTitleCase = module.exports.toTitleCase;