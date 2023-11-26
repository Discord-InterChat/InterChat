import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
import { colors } from '../../../utils/Constants.js';
import locales from '../../../utils/locales.js';

export default class Vote extends BaseCommand {
  readonly data = {
    name: 'vote',
    description: 'Voting perks and vote link.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setDescription(
        locales({ phrase: 'commands.vote.embed.description', locale: interaction.user.locale }),
      )
      .setColor(colors.interchatBlue);

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Vote!')
        .setEmoji('🗳️')
        .setURL('https://top.gg/bot/769921109209907241/vote'),
    );

    await interaction.reply({ embeds: [embed], components: [button] });
  }
}
