import { getReplyMethod } from '#main/utils/Utils.js';
import {
  ActionRowBuilder,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  RepliableInteraction,
} from 'discord.js';
import { emojis } from '#main/utils/Constants.js';

type ButtonEmojis = {
  back: string;
  exit: string;
  next: string;
};

type RunOptions = {
  idle: number;
  ephemeral: boolean;
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

  private formatMessage(
    actionBtns: ActionRowBuilder<ButtonBuilder>,
    replyOpts: BaseMessageOptions,
  ) {
    return { ...replyOpts, components: [actionBtns, ...(replyOpts.components || [])] };
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

  /**
   * Paginates through a collection of embed pages and handles user ctxs with pagination buttons.
   * @param ctx - The command or message component ctx.
   * @param pages - An array of EmbedBuilder objects representing the pages to be displayed.
   * @param options - Optional configuration for the paginator.
   */
  public async run(ctx: RepliableInteraction, options?: RunOptions) {
    if (this.pages.length < 1) {
      const replyMethod = getReplyMethod(ctx);
      await ctx[replyMethod]({
        content: `${emojis.tick} No pages to display!`,
        ephemeral: true,
      });

      return;
    }

    let index = 0;
    const row = this.createButtons(index, this.pages.length);

    const resp = this.formatMessage(row, this.pages[index]);
    const replyMethod = getReplyMethod(ctx);
    const listMessage = await ctx[replyMethod]({
      ...resp,
      content: resp.content ?? undefined,
      ephemeral: options?.ephemeral,
      flags: [],
    });

    const col = listMessage.createMessageComponentCollector({
      idle: options?.idle || 60000,
      componentType: ComponentType.Button,
    });

    col.on('collect', async (i) => {
      if (i.customId === 'page_:back') index--;
      else if (i.customId === 'page_:next') index++;
      else if (i.customId === 'page_:exit') return col.stop();

      const newRow = this.createButtons(index, this.pages.length);
      const newBody = this.formatMessage(newRow, this.pages[index]);

      // edit the message only if the customId is one of the paginator buttons
      if (i.customId.startsWith('page_:')) await i.update(newBody);
    });

    col.on('end', async () => {
      await listMessage.edit({ components: [] }).catch(() => null);
    });
  }
}
