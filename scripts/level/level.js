const Levels = require('discord-xp');
const { cbhq } = require('../../utils');

module.exports = {
	async execute(interaction) {
		const subcommandGroup = interaction.options.getSubcommandGroup();
		const userOpt = interaction.options.getString('user');
		const level = interaction.options.getInteger('level');

		const user = await interaction.client.users.fetch(userOpt);

		if (subcommandGroup == 'add') {
			Levels.appendLevel(userOpt, cbhq, level);
			interaction.reply(`I have added ${level} Level(s) to ${user.username}`);
		}
		else if (subcommandGroup == 'remove') {
			Levels.subtractLevel(userOpt, cbhq, level);
			interaction.reply(`I have removed ${level} Level(s) from ${user.username}`);
		}
		else if (subcommandGroup == 'set') {
			Levels.setLevel(userOpt, cbhq, level);
			interaction.reply(`I have set ${level} Level(s) to ${user.username}`);
		}
	},
};