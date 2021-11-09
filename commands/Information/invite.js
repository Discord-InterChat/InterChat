const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Invite the bot to your server'),
	async execute(interaction) {
		const embed = new MessageEmbed()
			.setTitle('Invite meeeeeee')
			.setDescription(`[Invite!](<${interaction.client.generateInvite({ scopes: ['applications.commands', 'bot'] })}>)`);
		await interaction.reply({ embeds: [embed] });
	},
};