import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, CommandInteraction, ComponentType, ButtonInteraction } from 'discord.js';
import emojis from './JSON/emoji.json';

export interface PaginatorOptions {
  stopAfter?: number;
  /** only supports buttons at the moment */
  extraComponent?: {
    actionRow: ActionRowBuilder<ButtonBuilder>[];
    updateComponents?(pageNumber: number): ActionRowBuilder<ButtonBuilder>;
    execute(i: ButtonInteraction): void;
  }
  btnEmojis?: {
    back: string;
    exit: string;
    next: string;
  };
}

/**
 * @param stopAfter - Number in milliseconds
 */
export async function paginate(interaction: CommandInteraction, pages: EmbedBuilder[], options?: PaginatorOptions) {
  if (pages.length < 1) {
    interaction.reply({ content: `${emojis.normal.tick} No more pages to display!`, ephemeral: true });
    return;
  }

  const emojiBack = options?.btnEmojis?.back || emojis.normal.back;
  const emojiExit = options?.btnEmojis?.exit || '🛑';
  const emojiNext = options?.btnEmojis?.next || emojis.normal.forward;

  let index = 0;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder().setEmoji(emojiBack).setCustomId('1').setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setEmoji(emojiExit).setCustomId('3').setStyle(ButtonStyle.Danger).setLabel(`Page ${index + 1} of ${pages.length}`),
    new ButtonBuilder().setEmoji(emojiNext).setCustomId('2').setStyle(ButtonStyle.Primary).setDisabled(pages.length <= index + 1),
  ]);

  const components: ActionRowBuilder<ButtonBuilder>[] = [row];


  if (options?.extraComponent) components.push(...options.extraComponent.actionRow);

  const data = {
    embeds: [pages[index]],
    components,
  };
  const listMessage = interaction.replied || interaction.deferred ? await interaction.followUp(data) : await interaction.reply(data);

  const col = listMessage.createMessageComponentCollector({
    idle: options?.stopAfter || 60000,
    componentType: ComponentType.Button,
  });

  col.on('collect', (i) => {
    if (i.customId === '1') {
      index--;
    }
    else if (i.customId === '2') {
      index++;
    }
    else if (i.customId === '3') {
      col.stop();
      return;
    }
    else if (options?.extraComponent) {
      options.extraComponent.execute(i);
      return;
    }

    row.setComponents([
      row.components[0].setDisabled(index === 0),
      row.components[1].setLabel(`Page ${index + 1} of ${pages.length}`),
      row.components[2].setDisabled(index === pages.length - 1),
    ]);

    if (options?.extraComponent?.updateComponents) {
      components[1] = options.extraComponent.updateComponents(index);
    }

    i.update({
      components,
      embeds: [pages[index]],
    });
  });

  col.on('end', () => {
    listMessage.edit({ components: [] });
  });

}
