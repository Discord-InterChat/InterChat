const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('guide')
		.setDescription('Sends link for the bot\'s guide.'),
	async execute(interaction) {
		await interaction.reply('Please refer to [this](https://gist.github.com/Supreme1707/60e14c12a326729bb7396984372d5460) for the how-to guide.');
	},
};