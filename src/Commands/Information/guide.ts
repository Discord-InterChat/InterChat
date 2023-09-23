import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import help from '../Main/help';

export default {
  data: new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Alias for /help.'),
  async execute(interaction: ChatInputCommandInteraction) {
    help.execute(interaction);
  },
};
