const Levels = require('discord-xp');
const { mainGuilds } = require('../../utils/utils');

module.exports = {
	async execute(interaction) {
		const subcommandGroup = interaction.options.getSubcommandGroup();
		const userOpt = interaction.options.getMember('user');
		const level = interaction.options.getInteger('level');
		const user = await interaction.client.users.fetch(userOpt);

		if (subcommandGroup == 'set') {
			Levels.setLevel(userOpt, mainGuilds.cbhq, level);
			interaction.reply(`I have set ${level} Level(s) to ${user.username}`);
		}
	},
};