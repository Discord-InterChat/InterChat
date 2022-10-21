import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../Utils/functions/utils';

export default {
	data: new SlashCommandBuilder()
		.setName('rules')
		.setDescription('Sends rules of the bot and chat network'),
	async execute(interaction: ChatInputCommandInteraction) {
		const embed = new EmbedBuilder()
			.setTitle(`${interaction.client.emoji.normal.clipart} ChatBot Rules`)
			.setDescription(
				stripIndents`
				1. No spamming or flooding.
				2. Refrain from insulting other users.
				3. Advertising of any kind is not allowed.
				4. Do not bring private matters into this chat.
				5. Do not make the chat uncomfortable for other users.
				6. Profanity and slurs are not allowed while using the network. 
				7. Be respectful of the decisions made by chat network moderators.
				8. Any content deemed explicit/NSFW are prohibited and will get you blacklisted.
				9. Use the **setup** command in only channels which are supposed to be receiving messages.
				10. Use the **suggest** command for suggestions and the **report** command for reporting only.
				11. We ask that you only use English when using our ChatBot. Should the need arise, our staff can take action.

				*If you have any questions, please join the [support server](https://discord.gg/6bhXQynAPs).*`,
			)
			.setColor(colors('chatbot'))
			.setImage('https://i.imgur.com/D2pYagc.png')
			.setFooter({ text: 'Note: Rules not explicitly mentioned here may apply as well.', iconURL:'https://cdn.discordapp.com/emojis/950424770229440533.png?&quality=lossless' });
		await interaction.reply({ embeds: [embed], ephemeral: true });

	},
};