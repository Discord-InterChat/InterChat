import type BaseCommand from '#main/core/BaseCommand.js';
import Context from '#main/core/CommandContext/Context.js';
import {
  type APIModalInteractionResponseCallbackData,
  ActionRowBuilder,
  type ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  ComponentType,
  type JSONEncodable,
  type Message,
  type MessageEditOptions,
  type MessagePayload,
  type MessageReplyOptions,
  type ModalComponentData,
} from 'discord.js';

export default class PrefixContext extends Context<{
  interaction: Message;
  ctx: PrefixContext;
  responseType: Message;
}> {
  private lastReply: Message | null = null;
  private _deferred = false;

  private readonly _args = new Collection<
    string,
    { value: string; type: ApplicationCommandOptionType }
  >();

  constructor(message: Message, command: BaseCommand, args: string[]) {
    super(message, command);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(this.command.options).forEach(([_, data], index) => {
      this.args.set(data.name, { value: args[index], type: data.type });
    });
  }

  public get args() {
    return this._args;
  }

  public get deferred() {
    return this._deferred;
  }

  public async reply(data: string | MessagePayload | MessageReplyOptions) {
    this.lastReply = await this.interaction.reply(data);
    return this.lastReply;
  }

  public async deleteReply() {
    await this.lastReply?.delete();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async deferReply(_opts?: { flags?: string[] }) {
    // NOTE: Mayeb for ephemeral messages we can use the flags property to DM user instead
    this._deferred = true;
    this.lastReply = await this.interaction.reply('Processing...');
    return this.lastReply;
  }

  public async editReply(data: string | MessagePayload | MessageEditOptions) {
    return await this.lastReply?.edit(data) ?? null;
  }

  public async showModal(
    modal:
			| JSONEncodable<APIModalInteractionResponseCallbackData>
			| ModalComponentData
			| APIModalInteractionResponseCallbackData,
  ) {
    const r = await this.reply({
      content: 'Click button to enter data.',
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('openForm')
            .setLabel('Open Form')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });

    const collector = r?.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.customId === 'openForm' && i.user.id === this.interaction.author.id,
      idle: 60000,
    });

    collector?.on('collect', async (i) => {
      await i.showModal(modal);
    });
  }
}
