const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');

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
		const embed = new MessageEmbed()
			.setTitle('Help')
			.setDescription(`Hey all, we have some news for you! Check out the /updates command to take a look at the future of ChatBot!\n\nList of Commands:\n${listOfCommands}`)
			.setAuthor({ name: 'Requested By: ' + interaction.user.tag, iconURL: interaction.user.avatarURL({ dynamic: true }) })
			.setFooter(interaction.client.user.tag, interaction.client.user.avatarURL())
			.setTimestamp();
		await interaction.reply({ embeds: [embed] });
	},
};