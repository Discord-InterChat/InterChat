import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Sends link for the bot\'s guide.'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply('Please refer to [this](https://interchat.gitbook.io/docs/guide) for the how-to guide.');
  },
};
