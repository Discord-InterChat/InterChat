import { ChatInputCommandInteraction } from 'discord.js';
import Levels from 'discord-xp';
import { constants } from '../../../../src/Utils/functions/utils';

module.exports = {
	async execute(interaction: ChatInputCommandInteraction) {
		if (interaction.inCachedGuild()) {
			const subcommandGroup = interaction.options.getSubcommandGroup();
			const userOpt = interaction.options.getMember('user');
			const level = interaction.options.getInteger('level');
			const user = await interaction.client.users.fetch(String(userOpt?.id));

			if (subcommandGroup == 'set') {
				Levels.setLevel(String(userOpt?.id), constants.mainGuilds.cbhq, Number(level));
				interaction.reply(`I have set ${level} Level(s) to ${user.username}`);
			}
		}
	},
};