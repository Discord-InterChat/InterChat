const logger = require('./logger');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

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
	cbhq: '969920027421732874', // FIXME: Change this to 770256165300338709 later (cbhq real guild)
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
		try {
			const verification = [];
			verification.push('staff'); // FIXME: Change later this for testing
			return verification;

			// 	const guild = await interaction.client.guilds.fetch('770256165300338709');
			// 	const member = await guild.members.fetch(interaction.user.id);
			// 	const roles = member._roles;
			// 	const verification = [];

			// 	if (roles.includes(developers)) {
			// 		verification.push('developer');
			// 	}

			// 	if (roles.includes(staff)) {
			// 		verification.push('staff');
			// 	}

		// 	return verification;
		}
		catch (e) {
			return '';
		}
	},
};