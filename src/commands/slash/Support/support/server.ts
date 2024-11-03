import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Support from './index.js';
import Constants from '#utils/Constants.js';

export default class SupportServer extends Support {
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('InterChat Central')
      .setDescription(`[Click Here](${Constants.Links.SupportInvite}) to join the support server.`)
      .setColor(Constants.Colors.interchatBlue)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
}
