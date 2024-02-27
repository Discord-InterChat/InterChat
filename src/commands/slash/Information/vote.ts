import {
	ChatInputCommandInteraction,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from 'discord.js';
import BaseCommand from '../../../core/BaseCommand.js';
import { colors, emojis } from '../../../utils/Constants.js';
import { t } from '../../../utils/Locale.js';

export default class Vote extends BaseCommand {
	readonly data = {
		name: 'vote',
		description: 'Voting perks and vote link.',
	};
	async execute(interaction: ChatInputCommandInteraction) {
		const { locale } = interaction.user;
		const embed = new EmbedBuilder()
			.setDescription(t({ phrase: 'vote.description', locale }))
			.setFooter({
				text: t({ phrase: 'vote.footer', locale }),
				iconURL: 'https://i.imgur.com/NKKmav5.gif',
			})
			.setColor(colors.interchatBlue);

		const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setStyle(ButtonStyle.Link)
				.setLabel('Vote')
				.setEmoji(emojis.ghost_heart)
				.setURL('https://top.gg/bot/769921109209907241/vote'),
		);

		await interaction.reply({ embeds: [embed], components: [button] });
	}
}
