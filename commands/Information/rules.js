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
				1. No spamming on the chat. This might get you banned from using this chat feature.
				2. No using the bot for purposes other than fun.
				3. No insulting other people in the chat.
				4. Do not bring private matters into this chat.
				5. Do not spam any of the commands.
				6. Do not DM the developers for unnecessary reasons.
				7. Do not make the chat uncomfortable for other users.
				8. Use the suggest command for suggestions or the report command for reporting bugs only.
				9. Use the connect command in only channels which are supposed to be receiving messages.
				10. DO NOT SELF-PROMO. This will get you banned too!
				11. Please support the bot by joining the ChatBot support server.
			`)
			.setColor(colors())
			.setImage('https://images-ext-2.discordapp.net/external/k9bElI9Z2mxhi2DTO783PI-wj00ledbPPvzZE-gPG2k/https/media.discordapp.net/attachments/770258662694060032/799566242276704287/standard_9.gif?width=400&height=51')
			.setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.avatarURL() });
		await interaction.member.send({ embeds: [embed] });
		await interaction.reply(`Sent the rules to your DMs ${normal.checkGreen}`);

	},
};