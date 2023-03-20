import NetworkLeveling from '../../Structures/levels';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../../src/Utils/functions/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('See the network leaderboard'),
  async execute(interaction: ChatInputCommandInteraction) {
    const levels = new NetworkLeveling();
    const rawLevels = await levels.getAllDocuments({ sortLevels: 'desc', limit: 10 });
    const errorEmbed = new EmbedBuilder().setDescription('Nobody is in the leaderboard.');

    if (rawLevels.length > 0 == false) return await interaction.reply({ embeds: [errorEmbed] });

    const leaderboard = rawLevels.map(({ level, userId, xp }) => {
      interaction.client.users.fetch(userId); // put it into cache lol
      return { level, userId, xp, position: rawLevels.findIndex((i) => i.userId === userId) + 1 };
    });


    const leaderArr = leaderboard.map((e) => {
      const postition = e.position === 1 ? '🥇' : e.position === 2 ? '🥈' : e.position === 3 ? '🥉' : `${e.position}.`;
      return {
        name: `\`${postition}\` ${interaction.client.users.cache.get(e.userId)?.tag}`,
        value: `Level: ${e.level}\nXP: ${e.xp.toLocaleString()}\n`,
      };
    });

    const leaderboardEmbed = new EmbedBuilder()
      .setColor(colors('chatbot'))
      .setTitle('**Leaderboard**')
      .setThumbnail(interaction.client.user?.avatarURL() as string)
      .setFields(leaderArr);

    await interaction.reply({ embeds: [leaderboardEmbed], ephemeral: true });
  },
};
