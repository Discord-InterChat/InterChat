import { ChatInputCommandInteraction } from 'discord.js';
import { rulesEmbed } from '../../../utils/Constants.js';
import Command from '../../Command.js';

export default class Rules extends Command {
  readonly data = {
    name: 'rules',
    description: 'Sends the network rules for InterChat.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ embeds: [rulesEmbed] });
  }
}