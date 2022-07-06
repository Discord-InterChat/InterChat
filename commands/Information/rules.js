const { SlashCommandBuilder } = require('@discordjs/builders');
const { stripIndents } = require('common-tags');
const { MessageEmbed } = require('discord.js');
const { colors } = require('../../utils');

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
				4. Do not DM the developers for unnecessary reasons.
				5. Do not make the chat uncomfortable for other users.
				6. Do not use the bot for any other purpose than fun.
				7. Profanity and slurs are not allowed while using the network. 
				8. Use the **suggest** command for suggestions and the **report** command for reporting only.
				9. Use the **connect** command in only channels which are supposed to be receiving messages.
				10. Advertising is not allowed.
				11. Refrain from insulting other users.
				12. The decision of the staff is final.
				13. Posting inappropriate content is not allowed, and will get you blacklisted. This includes images, videos, and messages.
				14. Respect the staff and moderators of the chat network.
				15. We ask that you only use English when using our ChatBot. Should the need arise, our staff can take action.
				16. Bypassing any of the rules will lead to a ban.

				*If you have any questions, please join the [support server](https://discord.gg/6bhXQynAPs).*
				`)
			.setColor(colors('chatbot'))
			.setImage('https://images-ext-2.discordapp.net/external/k9bElI9Z2mxhi2DTO783PI-wj00ledbPPvzZE-gPG2k/https/media.discordapp.net/attachments/770258662694060032/799566242276704287/standard_9.gif?width=400&height=51')
			.setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.avatarURL() })
			.setFooter({ text: 'Note: Rules not explicitly mentioned here may apply as well.', iconURL: 'https://cdn.discordapp.com/emojis/950424770229440533.png?&quality=lossless' });
		await interaction.reply({ embeds: [embed], ephemeral: true });

	},
};