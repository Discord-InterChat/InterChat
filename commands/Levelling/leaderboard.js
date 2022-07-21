const { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction } = require('discord.js');
const Levels = require('discord-xp');
const { colors, cbhq } = require('../../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Shows the leaderboard'),
	/**
	* @param {ChatInputCommandInteraction} interaction
	*/
	async execute(interaction) {
		const rawLeaderboard = await Levels.fetchLeaderboard(cbhq, 10);
		const errorEmbed = new EmbedBuilder().setDescription('Nobody is in the leaderboard.');

		if (rawLeaderboard == false) return await interaction.reply({ embeds: [errorEmbed] });

		const leaderboard = await Levels.computeLeaderboard(interaction.client, rawLeaderboard, true);

		const leaderArr = [];
		leaderboard.map((e) => {
			let pos = e.position;
			pos = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos + '.';
			leaderArr.push({ name: `\`${pos}\` ${e.username}#${e.discriminator}`, value: `Level: ${e.level}\nXP: ${e.xp.toLocaleString()}\n` });
		});

		const leaderboardEmbed = new EmbedBuilder()
			.setColor(colors('chatbot'))
			.setTitle('**Leaderboard**')
			.setThumbnail(interaction.client.user.avatarURL())
			.setFields(leaderArr);

		return await interaction.reply({ embeds:[leaderboardEmbed] });
	},
};