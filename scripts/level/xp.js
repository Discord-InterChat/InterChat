const Levels = require('discord-xp');
const { cbhq } = require('../../utils');

module.exports = {
	async execute(interaction) {
		const subcommandGroup = interaction.options.getSubcommandGroup();
		const userOpt = interaction.options.getString('user');
		const xp = interaction.options.getInteger('xp');

		const user = await interaction.client.users.fetch(userOpt);
		const userData = await Levels.fetch(userOpt, cbhq, true);

		if (xp < 0) return interaction.reply('You can\'t add negative XP.');

		switch (subcommandGroup) {
		case 'set':
			Levels.setXp(userOpt, cbhq, xp);
			interaction.reply(`I have set ${xp} XP to ${user.username}`);
			break;

		case 'add':
			Levels.appendXp(userOpt, cbhq, xp);
			interaction.reply(`I have added ${xp} XP to ${user.username}`);
			break;

		case 'remove':
			if (userData.xp - xp < 0) return interaction.reply('You can\'t remove negative XP.');
			Levels.subtractXp(userOpt, cbhq, xp);
			interaction.reply(`I have removed ${xp} XP from ${user.username}`);
			break;

		default:
			interaction.reply('Invalid subcommand.');
			break;
		}
	},
};
