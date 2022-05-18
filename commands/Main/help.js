const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Want help? Here it comes!'),
	async execute(interaction) {
		const commands = interaction.client.commands;
		let listOfCommands = '';
		commands.forEach((value, key) => {
			listOfCommands += `\`${key}\` - ${value.data.description}\n`;
		});
		const embed = new EmbedBuilder()
			.setTitle('Help')
			.setDescription('Hey all, we have some news for you! Check out the `/updates` command to take a look at the future of ChatBot!')
			.addFields([{ name: 'List of Commands: ', value: listOfCommands }])
			.setFooter({ text: 'Requested By: ' + interaction.user.tag, iconURL: interaction.user.avatarURL({ dynamic: true }) })
			.setAuthor({ name: interaction.client.user.username, iconURL: interaction.client.user.avatarURL() })
			.setTimestamp();
		await interaction.reply({ embeds: [embed] });
	},
};