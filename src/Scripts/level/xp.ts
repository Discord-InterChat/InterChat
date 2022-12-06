import Levels from 'discord-xp';
import { ChatInputCommandInteraction } from 'discord.js';
import { constants } from '../../Utils/functions/utils';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction) {
		const subcommandGroup = interaction.options.getSubcommandGroup();
		const userOpt = interaction.options.getString('user');
		const xp = interaction.options.getInteger('xp');

		const user = await interaction.client.users.fetch(String(userOpt));
		const userData = await Levels.fetch(String(userOpt), constants.mainGuilds.cbhq, true);

		if (Number(xp) < 0) return interaction.reply('You can\'t add negative XP.');

		switch (subcommandGroup) {
			case 'set':
				Levels.setXp(String(userOpt), constants.mainGuilds.cbhq, Number(xp));
				interaction.reply(`I have set ${xp} XP to ${user.username}`);
				break;

			case 'add':
				Levels.appendXp(String(userOpt), constants.mainGuilds.cbhq, Number(xp));
				interaction.reply(`I have added ${xp} XP to ${user.username}`);
				break;

			case 'remove':
				if (userData.xp - Number(xp) < 0) return interaction.reply('You can\'t remove negative XP.');
				Levels.subtractXp(String(userOpt), constants.mainGuilds.cbhq, Number(xp));
				interaction.reply(`I have removed ${xp} XP from ${user.username}`);
				break;

			default:
				interaction.reply('Invalid subcommand.');
				break;
		}
	},
};
