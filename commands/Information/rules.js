const { SlashCommandBuilder } = require('@discordjs/builders');
const { stripIndents } = require('common-tags');
const { MessageEmbed } = require('discord.js');
const { colors } = require('../../utils');
const { normal } = require('../../emoji.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rules')
		.setDescription('Sends rules of the bot and chat network'),
	async execute(interaction) {
		const embed = new MessageEmbed()
			.setTitle('ChatBot Rules')
			.setDescription(stripIndents`
				1. No spamming or flooding.
				2. Do not bring private matters into this chat.
				3. Do not spam any of the commands.
				4. Do not DM the developers for unnecessary reasons.
				5. Do not make the chat uncomfortable for other users.
				6. Do not use the bot for any other purpose than fun.
				7. Do not use slurs or profanity. 
				8. Use the **suggest** command for suggestions and the **report** command for reporting only.
				9. Use the **connect** command in only channels which are supposed to be receiving messages.
				10. Advertising is not allowed.
				11. Refrain from insulting other users.
				12. Posting inappropriate content is not allowed, and will get you blacklisted. This includes images, videos, and messages.
				13. Respect the staff and moderators of the chat network.

				*If you have any questions, please join the support server.*
				`)
			.setColor(colors('chatbot'))
			.setImage('https://images-ext-2.discordapp.net/external/k9bElI9Z2mxhi2DTO783PI-wj00ledbPPvzZE-gPG2k/https/media.discordapp.net/attachments/770258662694060032/799566242276704287/standard_9.gif?width=400&height=51')
			.setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.avatarURL() });
		await interaction.member.send({ embeds: [embed] });
		await interaction.reply({ content: `Sent the rules to your DMs ${normal.checkGreen}`, ephemeral: true });

	},
};