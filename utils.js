const logger = require('./logger');

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
	getCredits: async () => {
		let creditArray = [];

		creditArray = creditArray.concat(module.exports.developers, module.exports.staff);

		return creditArray;
	},
};