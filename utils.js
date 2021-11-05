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
};