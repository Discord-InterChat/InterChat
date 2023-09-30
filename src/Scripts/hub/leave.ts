import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder } from 'discord.js';
import { getDb } from '../../Utils/utils';
import emojis from '../../Utils/JSON/emoji.json';

export default {
  async execute(interaction: ChatInputCommandInteraction, channelId: string) {
    const { normal } = emojis;
    const db = getDb();

    if (!await db.connectedList.findFirst({ where: { channelId } })) {
      return await interaction.reply(`${normal.no} The channel ${channelId} does not have any networks.`);
    }

    const choiceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder().setCustomId('yes').setLabel('Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('no').setLabel('No').setStyle(ButtonStyle.Danger),
    ]);

    const resetConfirmEmbed = new EmbedBuilder()
      .setTitle('Delete Network Connection')
      .setDescription('Are you sure? You will have to rejoin the hub to use the network again! All previous connection data will be lost.')
      .setColor('Red')
      .setFooter({ text: 'Confirm within the next 10 seconds.' });

    const resetConfirmMsg = await interaction.reply({
      embeds: [resetConfirmEmbed],
      components: [choiceButtons],
      fetchReply: true,
    });

    const resetCollector = resetConfirmMsg.createMessageComponentCollector({
      filter: (m) => m.user.id == interaction.user.id,
      componentType: ComponentType.Button,
      idle: 10_000,
      max: 1,
    });

    // Creating collector for yes/no button
    resetCollector.on('collect', async (collected) => {
      if (collected.customId === 'no') {
        await interaction.deleteReply();
        return;
      }

      await db.connectedList.delete({ where: { channelId } });
      await collected.update({
        content: `${normal.yes} Deleted network connection from <#${channelId}> and left the hub!`,
        embeds: [],
        components: [],
      }).catch(() => null);
    });

    resetCollector.on('end', () => {
      resetConfirmMsg.delete().catch(() => null);
    });
  },
};
