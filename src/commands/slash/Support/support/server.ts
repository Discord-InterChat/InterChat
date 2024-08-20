import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { LINKS, colors } from '#main/utils/Constants.js';
import Support from './index.js';

export default class SupportServer extends Support {
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('InterChat Central')
      .setDescription(`[Click Here](${LINKS.SUPPORT_INVITE}) to join the support server.`)
      .setColor(colors.interchatBlue)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
}
