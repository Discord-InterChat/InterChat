import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  CommandInteraction,
  ComponentType,
  ButtonInteraction,
} from 'discord.js';
import { emojis } from './Constants.js';

export interface PaginatorOptions {
  /** Number in milliseconds */
  stopAfter?: number;
  /** only supports buttons at the moment */
  extraComponent?: {
    actionRow: ActionRowBuilder<ButtonBuilder>[];
    updateComponents?(pageNumber: number): ActionRowBuilder<ButtonBuilder>;
    execute(i: ButtonInteraction): void;
  };
  btnEmojis?: {
    back: string;
    exit: string;
    next: string;
  };
}

export async function paginate(
  interaction: CommandInteraction,
  pages: EmbedBuilder[],
  options?: PaginatorOptions,
) {
  if (pages.length < 1) {
    interaction.reply({ content: `${emojis.tick} No more pages to display!`, ephemeral: true });
    return;
  }

  const emojiBack = options?.btnEmojis?.back ?? emojis.back;
  const emojiExit = options?.btnEmojis?.exit ?? '🛑';
  const emojiNext = options?.btnEmojis?.next ?? emojis.forward;

  let index = 0;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setEmoji(emojiBack)
      .setCustomId('page_:back')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setEmoji(emojiExit)
      .setCustomId('page_:exit')
      .setStyle(ButtonStyle.Danger)
      .setLabel(`Page ${index + 1} of ${pages.length}`),
    new ButtonBuilder()
      .setEmoji(emojiNext)
      .setCustomId('page_:next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(pages.length <= index + 1),
  ]);

  const components: ActionRowBuilder<ButtonBuilder>[] = [row];

  if (options?.extraComponent) components.push(...options.extraComponent.actionRow);

  const data = {
    embeds: [pages[index]],
    components,
  };
  const listMessage =
    interaction.replied || interaction.deferred
      ? await interaction.followUp(data)
      : await interaction.reply(data);

  const col = listMessage.createMessageComponentCollector({
    idle: options?.stopAfter || 60000,
    componentType: ComponentType.Button,
  });

  col.on('collect', (i) => {
    if (i.customId === 'page_:back') {
      index--;
    }
    else if (i.customId === 'page_:exit') {
      index++;
    }
    else if (i.customId === 'page_:next') {
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
