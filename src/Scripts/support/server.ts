import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { constants } from '../../Utils/misc/utils';

export default {
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('InterChat Central')
      .setDescription('[Click Here](<https://discord.gg/6bhXQynAPs>)')
      .setColor(constants.colors.interchatBlue)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};