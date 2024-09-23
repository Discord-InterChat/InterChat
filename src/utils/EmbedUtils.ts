import Constants, { emojis } from '#main/config/Constants.js';
import { stripIndents } from 'common-tags';
import { codeBlock, EmbedBuilder } from 'discord.js';

export class InfoEmbed extends EmbedBuilder {
  constructor() {
    super();
    this.setColor(Constants.Colors.invisible).setTitle(`${emojis.info} INFO:`);
  }

  removeTitle(): this {
    super.setTitle(null);
    return this;
  }
}

export class ErrorEmbed extends EmbedBuilder {
  private errorCode: string | undefined;
  constructor() {
    super();
    this.setTitle(`${emojis.no} Error`)
      .setDescription(
        `An error occurred while executing this command. Please join our [support server](${Constants.Links.SupportInvite}) and report the Error Code!`,
      )
      .setColor('Red');
  }

  setErrorCode(errorCode: string): this {
    this.errorCode = errorCode;

    super.setDescription(stripIndents`
      ${this.data.description ?? ''}

      **Error Code:**
      ${codeBlock(errorCode)}
    `);

    return this;
  }

  setDescription(description: string): this {
    super.setDescription(description);
    if (this.errorCode) this.setErrorCode(this.errorCode);

    return this;
  }
}
