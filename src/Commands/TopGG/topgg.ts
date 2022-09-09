import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { constants } from '../../Utils/functions/utils';

export default {
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('topgg vote system'),
	async execute(interaction: ChatInputCommandInteraction) {
		const voted = await constants.topgg.hasVoted(interaction.user.id);
		if (voted) {await interaction.reply({ content: 'Thanks for voting!' });}
		else { await interaction.reply('You didnt vote :(');}
	},
};