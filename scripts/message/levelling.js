const Levels = require('discord-xp');
const { mainGuilds } = require('../../utils');
Levels.setURL('mongodb+srv://737:fbdKx0co1nGNXmle@discordbot.f4zr7.mongodb.net/Discord-ChatBot?retryWrites=true&w=majority');


module.exports = {
	/**
     *
     * @param {Levels} message
     */
	async execute(message) {
		const randomxp = Math.floor(Math.random() * 10) + 1;
		const haslevelxp = await Levels.appendXp(message.author.id, mainGuilds.cbhq, randomxp);
		if (haslevelxp) {
			const user = await Levels.fetch(message.author.id, mainGuilds.cbhq);
			message.reply(`🎉 Congrats you just levelled up to **${user.level}**!`);
		}
	},
};