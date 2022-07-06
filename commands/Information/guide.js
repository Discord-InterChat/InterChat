const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('guide')
		.setDescription('Sends link for the bot\'s guide.'),
	async execute(interaction) {
		await interaction.reply('Please refer to [this](https://gist.github.com/dev-737/29798432c54f4e320b92428e6ad4560e) for the how-to guide.');
	},
};