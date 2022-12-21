import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export default {
  developer: true,
  data: new SlashCommandBuilder()
    .setName('logout')
    .setDescription('Logs the bot out.')
    .setDefaultMemberPermissions('0'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply('Logged Out!');
    interaction.client.destroy();
    process.exit(0);
  },
};
