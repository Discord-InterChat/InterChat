import Levels from 'discord-xp';
import { Message } from 'discord.js';
import { constants } from '../../Utils/functions/utils';


module.exports = {
	async execute(message: Message) {
		const randomxp = Math.floor(Math.random() * 10) + 1;
		const haslevelxp = await Levels.appendXp(message.author.id, constants.mainGuilds.cbhq, randomxp);
		if (haslevelxp) {
			const user = await Levels.fetch(message.author.id, constants.mainGuilds.cbhq);
			message.reply(`🎉 Congrats you just levelled up to **${user.level}**!`);
		}
	},
};