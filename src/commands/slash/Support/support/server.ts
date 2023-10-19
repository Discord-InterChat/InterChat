import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { colors } from '../../../../utils/Constants.js';
import Support from './index.js';

export default class SupportServer extends Support {
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('InterChat Central')
      .setDescription('[Click Here](<https://discord.gg/6bhXQynAPs>)')
      .setColor(colors.interchatBlue)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
}