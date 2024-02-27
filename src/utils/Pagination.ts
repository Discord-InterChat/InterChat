import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  CommandInteraction,
  ComponentType,
  MessageComponentInteraction,
  MessageActionRowComponentBuilder,
} from 'discord.js';
import { emojis } from './Constants.js';

export interface PaginatorOptions {
  /** Number in milliseconds */
  stopAfter?: number;
  /** it's on you to handle the response */
  extraComponents?: {
    actionRow: ActionRowBuilder<MessageActionRowComponentBuilder>[];
    updateComponents(pageNumber: number): ActionRowBuilder<MessageActionRowComponentBuilder>;
  };
  btnEmojis?: {
    back: string;
    exit: string;
    next: string;
  };
}

/**
 * Paginates through a collection of embed pages and handles user interactions with pagination buttons.
 * @param interaction - The command or message component interaction.
 * @param pages - An array of EmbedBuilder objects representing the pages to be displayed.
 * @param options - Optional configuration for the paginator.
 */
export async function paginate(
  interaction: CommandInteraction | MessageComponentInteraction,
  pages: EmbedBuilder[],
  options?: PaginatorOptions,
) {
  if (pages.length < 1) {
    interaction.replied || interaction.deferred
      ? await interaction.followUp({
          content: `${emojis.tick} No pages to display!`,
          ephemeral: true,
        })
      : await interaction.reply({
          content: `${emojis.tick} No pages to display!`,
          ephemeral: true,
        });
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
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setEmoji(emojiExit)
      .setCustomId('page_:exit')
      .setStyle(ButtonStyle.Danger)
      .setLabel(`Page ${index + 1} of ${pages.length}`),
    new ButtonBuilder()
      .setEmoji(emojiNext)
      .setCustomId('page_:next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pages.length <= index + 1),
  ]);

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [row];

  if (options?.extraComponents) components.push(...options.extraComponents.actionRow);

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
    } else if (i.customId === 'page_:next') {
      index++;
    } else if (i.customId === 'page_:exit') {
      col.stop();
      return;
    }

    row.setComponents([
      row.components[0].setDisabled(index === 0),
      row.components[1].setLabel(`Page ${index + 1} of ${pages.length}`),
      row.components[2].setDisabled(index === pages.length - 1),
    ]);

    if (options?.extraComponents) {
      components[1] = options.extraComponents.updateComponents(index);
    }

    // edit the message only if the customId is one of the paginator buttons
    if (i.customId.startsWith('page_:')) {
      i.update({ embeds: [pages[index]], components });
    }
  });

  col.on('end', () => {
    listMessage.edit({ components: [] });
  });
}
