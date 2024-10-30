import { emojis } from '#main/config/Constants.js';
import Logger from '#main/utils/Logger.js';
import { getReplyMethod } from '#utils/Utils.js';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type BaseMessageOptions,
  type EmbedBuilder,
  type ModalSubmitInteraction,
  type RepliableInteraction,
} from 'discord.js';

type PaginationInteraction = Exclude<RepliableInteraction, ModalSubmitInteraction>;

type ButtonEmojis = {
  back: string;
  exit: string;
  next: string;
  search: string;
  select: string;
};

type RunOptions = {
  idle?: number;
  ephemeral?: boolean;
  deleteOnEnd?: boolean;
};

export class Pagination {
  private pages: BaseMessageOptions[] = [];
  private emojis: ButtonEmojis = {
    back: emojis.previous,
    exit: emojis.delete,
    next: emojis.next,
    search: emojis.search,
    select: '#️⃣',
  };

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

  private getPageContent(page: BaseMessageOptions): string {
    const searchableContent: string[] = [];

    if (page.content) {
      searchableContent.push(page.content);
    }

    const embedArray = Array.isArray(page.embeds) ? page.embeds : [page.embeds].filter(Boolean);

    for (const embed of embedArray) {
      if (!embed) continue;

      const embedData = (embed as EmbedBuilder).data || embed;

      if (embedData.title) searchableContent.push(embedData.title);
      if (embedData.description) searchableContent.push(embedData.description);
      if (embedData.author?.name) searchableContent.push(embedData.author.name);
      if (embedData.footer?.text) searchableContent.push(embedData.footer.text);

      if (embedData.fields?.length) {
        embedData.fields.forEach((field) => {
          searchableContent.push(field.name, field.value);
        });
      }
    }

    return searchableContent.join(' ').toLowerCase();
  }

  private async handlePageSelect(
    interaction: PaginationInteraction,
    totalPages: number,
  ): Promise<number | null> {
    const modal = new ModalBuilder().setCustomId('page_select_modal').setTitle('Go to Page');

    const pageInput = new TextInputBuilder()
      .setCustomId('page_number_input')
      .setLabel(`Enter page number (1-${totalPages})`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(4);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(pageInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);

    try {
      const modalSubmit = await interaction.awaitModalSubmit({
        time: 30000,
        filter: (i) => i.customId === 'page_select_modal',
      });

      const pageNumber = parseInt(modalSubmit.fields.getTextInputValue('page_number_input'));

      if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
        await modalSubmit.reply({
          content: `Please enter a valid page number between 1 and ${totalPages}`,
          ephemeral: true,
        });
        return null;
      }

      await modalSubmit.reply({
        content: `Going to page ${pageNumber}`,
        ephemeral: true,
      });
      return pageNumber - 1; // Convert to 0-based index
    }
    catch (error) {
      if (
        !error.message.includes(
          'Collector received no interactions before ending with reason: time',
        )
      ) {
        Logger.error('Page selection error:', error);
      }
      return null;
    }
  }

  private async handleSearch(interaction: PaginationInteraction): Promise<number | null> {
    const modal = new ModalBuilder().setCustomId('search_modal').setTitle('Search Pages');

    const searchInput = new TextInputBuilder()
      .setCustomId('search_input')
      .setLabel('Enter search term')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(100);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(searchInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);

    try {
      const modalSubmit = await interaction.awaitModalSubmit({
        time: 30000,
        filter: (i) => i.customId === 'search_modal',
      });

      const searchTerm = modalSubmit.fields.getTextInputValue('search_input').toLowerCase();
      const results: { page: number; matches: number }[] = [];

      for (let i = 0; i < this.pages.length; i++) {
        const content = this.getPageContent(this.pages[i]);
        const matchCount = (content.match(new RegExp(searchTerm, 'g')) || []).length;

        if (matchCount > 0) {
          results.push({ page: i, matches: matchCount });
        }
      }

      if (results.length > 0) {
        results.sort((a, b) => b.matches - a.matches);

        const topResult = results[0];
        const totalMatches = results.reduce((sum, result) => sum + result.matches, 0);
        const otherResultsStr =
          results.length > 1
            ? `-# ${emojis.info} Also found in the following pages: ${results.map((r) => r.page + 1).join(', ')}`
            : '';

        await modalSubmit.reply({
          content: stripIndents`
            **${emojis.search} Found ${totalMatches} match${totalMatches !== 1 ? 'es' : ''} across ${results.length} page${results.length !== 1 ? 's' : ''}.**
            Jumping to page ${topResult.page + 1} with ${topResult.matches} match${topResult.matches !== 1 ? 'es' : ''}.
            
            ${otherResultsStr}`,
          ephemeral: true,
        });

        return topResult.page;
      }

      await modalSubmit.reply({ content: 'No matches found', ephemeral: true });
      return null;
    }
    catch (error) {
      Logger.error('Search error:', error);
      return null;
    }
  }

  public async run(ctx: PaginationInteraction, options?: RunOptions) {
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

      if (i.customId === 'page_:search') {
        const newIndex = await this.handleSearch(i);
        if (newIndex !== null) {
          index = newIndex;
          const newRow = this.createButtons(index, this.pages.length);
          const newBody = this.formatMessage(newRow, this.pages[index]);
          await listMessage.edit(newBody);
        }
        return;
      }

      if (i.customId === 'page_:select') {
        const newIndex = await this.handlePageSelect(i, this.pages.length);
        if (newIndex !== null) {
          index = newIndex;
          const newRow = this.createButtons(index, this.pages.length);
          const newBody = this.formatMessage(newRow, this.pages[index]);
          await listMessage.edit(newBody);
        }
        return;
      }

      index = this.adjustIndex(i.customId, index);

      const newRow = this.createButtons(index, this.pages.length);
      const newBody = this.formatMessage(newRow, this.pages[index]);
      await i.update(newBody);
    });

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

      let ackd = false;
      if (!interaction.replied && !interaction.deferred) {
        await interaction.update({ components: [] });
        ackd = true;
      }

      if (options?.deleteOnEnd) await interaction.deleteReply();
      else if (ackd === false) await interaction.editReply({ components: [] });
    });
  }

  private adjustIndex(customId: string, index: number) {
    if (customId === 'page_:back') return Math.max(0, index - 1);
    if (customId === 'page_:next') return index + 1;
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
        .setEmoji(this.emojis.select)
        .setCustomId('page_:select')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setEmoji(this.emojis.back)
        .setCustomId('page_:back')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(index === 0),
      new ButtonBuilder()
        .setEmoji(this.emojis.exit)
        .setCustomId('page_:exit')
        .setLabel(`Page ${index + 1} of ${totalPages}`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setEmoji(this.emojis.next)
        .setCustomId('page_:next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages <= index + 1),
      new ButtonBuilder()
        .setEmoji(this.emojis.search)
        .setCustomId('page_:search')
        .setStyle(ButtonStyle.Secondary),
    ]);
  }
}
