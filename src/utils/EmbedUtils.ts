import { getEmoji } from '#main/utils/EmojiUtils.js';
import Constants from '#utils/Constants.js';
import { stripIndents } from 'common-tags';
import { APIEmbed, Client, codeBlock, Colors, EmbedBuilder, EmbedData, resolveColor } from 'discord.js';

export class InfoEmbed extends EmbedBuilder {
  constructor(data?: EmbedData | APIEmbed) {
    super({
      color: resolveColor(Constants.Colors.interchatBlue),
      ...data,
    });
  }

  removeTitle(): this {
    super.setTitle(null);
    return this;
  }

  setTitle(title?: string | null): this {
    if (title) super.setTitle(title);
    return this;
  }
}

export class ErrorEmbed extends EmbedBuilder {
  private errorCode: string | null = null;
  constructor(client: Client, data?: { errorCode?: string }) {
    super({
      title: `${getEmoji('x_icon', client)} Error`,
      description:
        'An error occurred while executing this command. Please join our [support server](https://discord.gg/interchat) and report the Error Code!',
      color: Colors.Red,
    });

    if (data?.errorCode) this.setErrorCode(data.errorCode);
  }

  setErrorCode(errorCode: string | null): this {
    this.errorCode = errorCode;

    if (!errorCode) return this;

    return super.setDescription(stripIndents`
      ${this.data.description ?? ''}

      **Error Code:**
      ${codeBlock(errorCode)}
    `);
  }

  setDescription(description: string): this {
    super.setDescription(description);
    if (this.errorCode) this.setErrorCode(this.errorCode);

    return this;
  }
}
