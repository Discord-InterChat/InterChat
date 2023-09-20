import { stripIndents } from 'common-tags';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../Utils/misc/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Voting perks and vote link.'),
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setDescription(stripIndents`
      # 🗳️ Support InterChat by Voting

      Your votes play a crucial role in boosting InterChat's ranking on Top.gg, so every vote matters! 

      As a token of our appreciation for your support, we offer exclusive perks for voters. By voting for InterChat, you gain access to:

      - Message Editing capabilities within hubs (More to come!)
      ### Cast your vote here: [Vote for InterChat](https://top.gg/bot/${interaction.client.user.id}/vote)
      We sincerely thank you for your support! 🙏
    `)
      .setColor(colors('chatbot'));

    const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Vote!')
        .setEmoji('🗳️')
        .setURL(`https://top.gg/bot/${interaction.client.user.id}/vote`),
    );

    await interaction.reply({ embeds: [embed], components: [button] });
  },
};
