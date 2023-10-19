import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
import { colors } from '../../../utils/Constants.js';

export default class Vote extends BaseCommand {
  readonly data = {
    name: 'vote',
    description: 'Voting perks and vote link.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setDescription(stripIndents`
    ## 🗳️ Vote for InterChat and Enjoy Exclusive Perks
    Your contribution is invaluable in elevating InterChat's position on Top.gg. Each and every vote makes a significant difference! 

    As our way of expressing gratitude for your support, we are thrilled to offer you exclusive advantages. By casting your vote for InterChat, you'll unlock:

    - Edit messages within hubs
    - Translating messages (and much more on the way!)
    
    We deeply appreciate your unwavering support. Thank you! 🙏 
  `)
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