import { stripIndents } from 'common-tags';
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../Utils/functions/utils';

export default {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Sends rules of the bot and chat network'),
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle(`${interaction.client.emoji.normal.clipart} Network Rules`)
      .setDescription(
        stripIndents`
        1. No spamming or flooding.
        3. Advertising of any kind is prohibited.
        4. Private matters should not be discussed in the network.
        5. Do not make the chat uncomfortable for other users.
        6. Using slurs is not allowed on the network.
        7. Trolling, insulting, and profanity is not allowed.
        8. Posting explicit or NSFW content will result in an immediate blacklist.
        9. Trivialization of sensitive topics such as self-harm, suicide and others which may cause offense to other members is prohibited.
        
        *If you have any questions, please join the [support server](https://discord.gg/6bhXQynAPs).*`,
      )
      .setColor(colors('chatbot'))
      .setImage('https://i.imgur.com/D2pYagc.png');
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
