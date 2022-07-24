const { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');
const Levels = require('discord-xp');
const { colors, mainGuilds } = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Shows the leaderboard'),
	/**
	* @param {ChatInputCommandInteraction} interaction
	*/
	async execute(interaction) {
		const rawLeaderboard = await Levels.fetchLeaderboard(mainGuilds.cbhq, 10);
		const errorEmbed = new EmbedBuilder().setDescription('Nobody is in the leaderboard.');

		if (rawLeaderboard == false) return await interaction.reply({ embeds: [errorEmbed] });

		const leaderboard = await Levels.computeLeaderboard(interaction.client, rawLeaderboard, true);

		const leaderArr = [];
		leaderboard.map((e) => {
			const postition = e.position === 1 ? '🥇' : e.position === 2 ? '🥈' : e.position === 3 ? '🥉' : `${e.position}.`;
			leaderArr.push({ name: `\`${postition}\` ${e.username}#${e.discriminator}`, value: `Level: ${e.level}\nXP: ${e.xp.toLocaleString()}\n` });
		});

		const leaderboardEmbed = new EmbedBuilder()
			.setColor(colors('chatbot'))
			.setTitle('**Leaderboard**')
			.setThumbnail(interaction.client.user.avatarURL())
			.setFields(leaderArr);

		return await interaction.reply({ embeds:[leaderboardEmbed] });
	},
};