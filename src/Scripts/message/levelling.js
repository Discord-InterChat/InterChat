const Levels = require('discord-xp');
const { mainGuilds } = require('../../utils/functions/utils');


module.exports = {
	async execute(message) {
		const randomxp = Math.floor(Math.random() * 10) + 1;
		const haslevelxp = await Levels.appendXp(message.author.id, mainGuilds.cbhq, randomxp);
		if (haslevelxp) {
			const user = await Levels.fetch(message.author.id, mainGuilds.cbhq);
			message.reply(`🎉 Congrats you just levelled up to **${user.level}**!`);
		}
	},
};