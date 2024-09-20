import BaseCommand from '#main/core/BaseCommand.js';
import Constants, { emojis } from '#main/config/Constants.js';
import { t } from '#main/utils/Locale.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  codeBlock,
  EmbedBuilder,
  time,
} from 'discord.js';

export default class Vote extends BaseCommand {
  readonly data = {
    name: 'vote',
    description: 'Voting perks and vote link.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const { id } = interaction.user;
    const userData = await interaction.client.userManager.getUser(id);
    const voteCount = String(userData?.voteCount ?? 0);
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const embed = new EmbedBuilder()
      .setDescription(t({ phrase: 'vote.description', locale }))
      .setFooter({
        text: t({ phrase: 'vote.footer', locale }),
        iconURL: 'https://i.imgur.com/NKKmav5.gif',
      })
      .setFields(
        {
          name: `${emojis.topggSparkles} Current Streak:`,
          value: codeBlock(voteCount),
          inline: true,
        },
        {
          name: 'Last Vote',
          value: userData?.lastVoted
            ? time(userData.lastVoted, 'R')
            : `[Vote Now](${Constants.Links.Vote})!`,
          inline: true,
        },
      )
      .setColor(Constants.Colors.invisible);

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Vote')
        .setEmoji(emojis.topggSparkles)
        .setURL(Constants.Links.Vote),
    );

    await interaction.reply({ embeds: [embed], components: [button] });
  }
}
