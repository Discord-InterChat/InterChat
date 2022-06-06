const logger = require('./logger');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const { MessageActionRow } = require('discord.js');
const emoji = require('./emoji.json');
dotenv.config();

const uri = process.env.MONGODB_URI;
let _db;

module.exports = {
	colors: () => {
		const colorArr = [
			'DEFAULT',
			'WHITE',
			'AQUA',
			'GREEN',
			'BLUE',
			'YELLOW',
			'PURPLE',
			'LUMINOUS_VIVID_PINK',
			'FUCHSIA',
			'GOLD',
			'ORANGE',
			'RED',
			'GREY',
			'NAVY',
			'DARK_AQUA',
			'DARK_GREEN',
			'DARK_BLUE',
			'DARK_PURPLE',
			'DARK_VIVID_PINK',
			'DARK_GOLD',
			'DARK_ORANGE',
			'DARK_RED',
			'DARK_GREY',
			'DARKER_GREY',
			'LIGHT_GREY',
			'DARK_NAVY',
			'BLURPLE',
			'GREYPLE',
			'DARK_BUT_NOT_BLACK',
			'NOT_QUITE_BLACK',
			'RANDOM',
		];
		return module.exports.choice(colorArr);
	},
	choice: (arr) => {
		return arr[Math.floor(Math.random() * arr.length)];
	},
	toTitleCase: (str) => {
		let upper = true;
		let newStr = '';
		for (let i = 0, l = str.length; i < l; i++) {
			if (str[i] == ' ') {
				upper = true;
				newStr += str[i];
				continue;
			}
			newStr += upper ? str[i].toUpperCase() : str[i].toLowerCase();
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
	developers: [828492978716409856n, 701727675311587358n, 526616688091987968n, 336159680244219905n, 808168843352080394n],
	staff: [442653948630007808n, 446709111715921920n],
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
			return await interaction.reply('You do not have permissions to run this command!');
		}

		return verification;
	},

	paginate: async (interaction, pages, time = 60000) => {
		if (!interaction || !pages || !(pages?.length > 0) || !(time > 10000)) throw new Error('Invalid Parameters');

		// eslint-disable-next-line prefer-const
		let index = 0, row = new MessageActionRow().addComponents([{
			type: 'BUTTON',
			customId: '1',
			emoji: emoji.interaction.back,
			style: 'SECONDARY',
			disabled: true,

		}, {
			type: 'BUTTON',
			customId: '3',
			emoji: emoji.interaction.delete,
			style: 'DANGER',

		}, {
			type: 'BUTTON',
			customId: '2',
			emoji: emoji.interaction.next,
			style: 'SECONDARY',
			disabled: pages.length <= index + 1,
		}]);


		let pagenumber = 0;
		pages[pagenumber].setFooter({ text: `Page ${pagenumber + 1} / ${pages.length}` });


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


			row.setComponents([{
				type: 'BUTTON',
				customId: '1',
				emoji: emoji.interaction.back,
				style: 'SECONDARY',
				disabled: index === 0,

			}, {
				type: 'BUTTON',
				customId: '3',
				emoji: emoji.interaction.delete,
				style: 'DANGER',

			}, { type: 'BUTTON',
				customId: '2',
				emoji: emoji.interaction.next,
				style: 'SECONDARY',
				disabled: index === pages.length - 1,
			}]);

			pages[pagenumber].setFooter({ text: `Page ${pagenumber + 1} / ${pages.length}` });

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
};