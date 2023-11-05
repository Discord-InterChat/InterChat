import { ChatInputCommandInteraction } from 'discord.js';
import { rulesEmbed } from '../../../utils/Constants.js';
import BaseCommand from '../../BaseCommand.js';

export default class Rules extends BaseCommand {
  readonly data = {
    name: 'rules',
    description: 'Sends the network rules for InterChat.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ embeds: [rulesEmbed] });
  }
}