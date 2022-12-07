import Levels from 'discord-xp';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { colors, constants } from '../../../src/Utils/functions/utils';

export default {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('See the network leaderboard'),
	async execute(interaction: ChatInputCommandInteraction) {
		const rawLeaderboard = await Levels.fetchLeaderboard(constants.mainGuilds.cbhq, 10);
		const errorEmbed = new EmbedBuilder().setDescription('Nobody is in the leaderboard.');

		if (rawLeaderboard.length > 0 == false) return await interaction.reply({ embeds: [errorEmbed] });

		const leaderboard = await Levels.computeLeaderboard(interaction.client, rawLeaderboard, true);

		const leaderArr = leaderboard.map((e) => {
			const postition = e.position === 1 ? '🥇' : e.position === 2 ? '🥈' : e.position === 3 ? '🥉' : `${e.position}.`;
			return {
				name: `\`${postition}\` ${e.username}#${e.discriminator}`,
				value: `Level: ${e.level}\nXP: ${e.xp.toLocaleString()}\n`,
			};
		});

		const leaderboardEmbed = new EmbedBuilder()
			.setColor(colors('chatbot'))
			.setTitle('**Leaderboard**')
			.setThumbnail(interaction.client.user?.avatarURL() as string)
			.setFields(leaderArr);

		await interaction.reply({ embeds: [leaderboardEmbed], ephemeral: true });
	},
};
