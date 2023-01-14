import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Sends rules of the bot and chat network'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ embeds: [interaction.client.rulesEmbed], ephemeral: true });
  },
};
