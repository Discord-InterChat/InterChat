import { emojis } from '#main/config/Constants.js';
import { getReplyMethod } from '#main/utils/Utils.js';
import {
  type BaseMessageOptions,
  type RepliableInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';

type ButtonEmojis = {
  back: string;
  exit: string;
  next: string;
};

type RunOptions = {
  idle?: number;
  ephemeral?: boolean;
  deleteOnEnd?: boolean;
};

export class Pagination {
  private pages: BaseMessageOptions[] = [];
  private emojis: ButtonEmojis = { back: emojis.previous, exit: emojis.delete, next: emojis.next };

  constructor(opts?: { emojis?: ButtonEmojis }) {
    if (opts?.emojis) this.emojis = opts.emojis;
  }

  public addPage(page: BaseMessageOptions) {
    this.pages.push(page);
    return this;
  }
  public setEmojis(btnEmojis: ButtonEmojis) {
    this.emojis = btnEmojis;
    return this;
  }
  public addPages(pageArr: BaseMessageOptions[]) {
    pageArr.forEach((page) => this.pages.push(page));
    return this;
  }
  public getPage(index: number) {
    return this.pages[index];
  }

  /**
   * Paginates through a collection of embed pages and handles user ctxs with pagination buttons.
   * @param ctx - The command or message component ctx.
   * @param pages - An array of EmbedBuilder objects representing the pages to be displayed.
   * @param options - Optional configuration for the paginator.
   */
  public async run(ctx: RepliableInteraction, options?: RunOptions) {
    const replyMethod = getReplyMethod(ctx);
    if (this.pages.length < 1) {
      await ctx[replyMethod]({
        content: `${emojis.tick} No results to display!`,
        ephemeral: true,
      });

      return;
    }

    let index = 0;
    const row = this.createButtons(index, this.pages.length);
    const resp = this.formatMessage(row, this.pages[index]);
    const listMessage = await ctx[replyMethod]({
      ...resp,
      content: resp.content ?? undefined,
      ephemeral: options?.ephemeral,
      fetchReply: true,
      flags: [],
    });

    const col = listMessage.createMessageComponentCollector({
      idle: options?.idle || 60000,
      componentType: ComponentType.Button,
      filter: (i) => i.customId.startsWith('page_:'),
    });

    col.on('collect', async (i) => {
      if (i.customId === 'page_:exit') {
        col.stop();
        return;
      }

      // inc/dec the index
      index = this.adjustIndex(i.customId, index);

      const newRow = this.createButtons(index, this.pages.length);
      const newBody = this.formatMessage(newRow, this.pages[index]);

      // edit the message only if the customId is one of the paginator buttons
      await i.update(newBody);
    });

    // bad code dont look
    col.on('end', async (interactions) => {
      const interaction = interactions.first();

      if (!interaction) {
        if (options?.ephemeral) {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          options?.deleteOnEnd
            ? await listMessage.delete()
            : await listMessage.edit({ components: [] });
        }
        return;
      }

      if (options?.deleteOnEnd) {
        // acknowledge the interaction if it hasn't been acknowledged yet
        if (!interaction.replied && !interaction.deferred) {
          await interaction.update({ components: [] });
        }
        await interaction.deleteReply();
      }
      else {
        await interaction.editReply({ components: [] });
      }
    });
  }

  private adjustIndex(customId: string, index: number) {
    if (customId === 'page_:back') return index - 1;
    else if (customId === 'page_:next') return index + 1;
    return index;
  }

  private formatMessage(
    actionButtons: ActionRowBuilder<ButtonBuilder>,
    replyOpts: BaseMessageOptions,
  ) {
    return { ...replyOpts, components: [actionButtons, ...(replyOpts.components || [])] };
  }

  private createButtons(index: number, totalPages: number) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setEmoji(this.emojis.back)
        .setCustomId('page_:back')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(index === 0),
      new ButtonBuilder()
        .setEmoji(this.emojis.exit)
        .setCustomId('page_:exit')
        .setStyle(ButtonStyle.Danger)
        .setLabel(`Page ${index + 1} of ${totalPages}`),
      new ButtonBuilder()
        .setEmoji(this.emojis.next)
        .setCustomId('page_:next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages <= index + 1),
    ]);
  }
}
