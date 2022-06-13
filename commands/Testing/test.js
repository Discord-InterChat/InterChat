const { SlashCommandBuilder } = require('@discordjs/builders');
const { Api } = require('@top-gg/sdk');
const dotenv = require('dotenv');

dotenv.config();
const topgg = new Api(process.env.TOPGG);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('topgg vote system'),
	async execute(interaction) {
		const voted = await topgg.hasVoted(interaction.user.id);
		if (voted) {await interaction.reply({ content: 'Thanks for voting!' });}

		else { await interaction.reply('You didnt vote :(');}
	},
};