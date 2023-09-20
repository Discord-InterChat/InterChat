import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { rulesEmbed } from '../../Utils/misc/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Sends rules of the bot and chat network'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ embeds: [rulesEmbed], ephemeral: true });
  },
};
