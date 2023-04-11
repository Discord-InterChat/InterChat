import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, CommandInteraction, ComponentType } from 'discord.js';

/**
 * @param stopAfter - Number in milliseconds
 */
export async function paginate(interaction: CommandInteraction, pages: EmbedBuilder[], stopAfter = 60000,
  buttons =
  {
    back: interaction.client.emotes.normal.back,
    exit: '🛑',
    next: interaction.client.emotes.normal.forward,
  }) {
  if (pages.length < 1) {
    interaction.reply({ content: `${interaction.client.emotes.normal.tick} No more pages to display!`, ephemeral: true });
    return;
  }

  let index = 0, pagenumber = 1;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder().setEmoji(buttons.back).setCustomId('1').setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setEmoji(buttons.exit).setCustomId('3').setStyle(ButtonStyle.Danger).setLabel(`Page ${pagenumber} of ${pages.length}`),
    new ButtonBuilder().setEmoji(buttons.next).setCustomId('2').setStyle(ButtonStyle.Primary).setDisabled(pages.length <= index + 1),
  ]);

  const data = {
    embeds: [pages[index]],
    components: [row],
    fetchReply: true,
  };
  const listMessage = interaction.replied || interaction.deferred ? await interaction.followUp(data) : await interaction.reply(data);

  const col = listMessage.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    idle: stopAfter,
    componentType: ComponentType.Button,
  });

  col.on('collect', (i) => {
    if (i.customId === '1') {
      pagenumber--;
      index--;
    }
    else if (i.customId === '2') {
      pagenumber++;
      index++;
    }
    else {
      col.stop();
      return;
    }

    row.setComponents([
      new ButtonBuilder().setEmoji(buttons.back).setStyle(ButtonStyle.Primary).setCustomId('1').setDisabled(index === 0),
      new ButtonBuilder().setEmoji(buttons.exit).setStyle(ButtonStyle.Danger).setCustomId('3').setLabel(`Page ${pagenumber} of ${pages.length}`),
      new ButtonBuilder().setEmoji(buttons.next).setStyle(ButtonStyle.Primary).setCustomId('2').setDisabled(index === pages.length - 1),
    ]);

    i.update({
      components: [row],
      embeds: [pages[index]],
    });
  });

  col.on('end', () => {
    listMessage.edit({ components: [] });
  });
}
