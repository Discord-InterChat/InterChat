import type BaseCommand from '#src/core/BaseCommand.js';
import Context from '#src/core/CommandContext/Context.js';
import { extractUserId, extractChannelId, extractRoleId } from '#src/utils/Utils.js';
import {
  type APIModalInteractionResponseCallbackData,
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  ComponentType,
  type JSONEncodable,
  type Message,
  type MessageEditOptions,
  type MessageReplyOptions,
  type ModalComponentData,
} from 'discord.js';

const acceptedBooleanValues = {
  true: true,
  false: false,
  yes: true,
  no: false,
  y: true,
  n: false,
};

export default class PrefixContext extends Context<{
  interaction: Message;
  ctx: PrefixContext;
  responseType: Message;
}> {
  private lastReply: Message | null = null;
  private _deferred = false;

  private readonly _args = new Collection<
    string,
    { value: string | number | boolean; type: ApplicationCommandOptionType }
  >();

  constructor(message: Message, command: BaseCommand, args: string[]) {
    super(message, command);
    let argIndex = 0;
    const commandOptions = Object.values(command.options);

    for (let i = 0; i < commandOptions.length; i++) {
      const option = commandOptions[i];
      if (argIndex >= args.length) {
        if (option.required) {
          throw new Error(`Missing required argument: ${option.name}`);
        }
        continue;
      }

      const currentArg = args[argIndex];
      const extracted = this.processArg(currentArg, option.type);
      let matchesFutureType = false;

      // Check if currentArg matches any future options' types (only if current option is String)
      if (option.type === ApplicationCommandOptionType.String) {
        for (let j = i + 1; j < commandOptions.length; j++) {
          const futureOption = commandOptions[j];
          if (this.processArg(currentArg, futureOption.type) !== null) {
            matchesFutureType = true;
            break;
          }
        }
      }

      if (extracted !== null) {
        this.args.set(option.name, {
          value: extracted,
          type: option.type,
        });
        argIndex++;
      }
      else if (
        option.type === ApplicationCommandOptionType.String &&
        !matchesFutureType
      ) {
        // Assign to String option if no future types match
        this.args.set(option.name, { value: currentArg, type: option.type });
        argIndex++;
      }
      else if (option.required) {
        throw new Error(
          `Required argument '${option.name}' of type ${option.type} not found.`,
        );
      }
      // Skip optional option and check again with the same argIndex
    }
  }

  private processArg(arg: string, type: ApplicationCommandOptionType) {
    switch (type) {
      case ApplicationCommandOptionType.User: {
        return extractUserId(arg);
      }
      case ApplicationCommandOptionType.Channel: {
        return extractChannelId(arg);
      }
      case ApplicationCommandOptionType.Role: {
        return extractRoleId(arg);
      }
      case ApplicationCommandOptionType.Number: {
        const num = Number(arg);
        return Number.isNaN(num) ? null : num;
      }
      case ApplicationCommandOptionType.Boolean: {
        const key = arg.toLowerCase() as keyof typeof acceptedBooleanValues;
        return key in acceptedBooleanValues ? acceptedBooleanValues[key] : null;
      }
      case ApplicationCommandOptionType.String: {
        return arg;
      }
      default: {
        return null;
      }
    }
  }

  public get args() {
    return this._args;
  }

  public get deferred() {
    return this._deferred;
  }
  public get replied() {
    return Boolean(this.lastReply);
  }

  public async reply(data: string | MessageReplyOptions) {
    this.lastReply = await this.interaction.reply(
      typeof data === 'string'
        ? { content: data }
        : { ...data, content: data.content ?? '' },
    );
    return this.lastReply;
  }

  public async deleteReply() {
    await this.lastReply?.delete();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async deferReply(_opts?: { flags?: string[] }) {
    // TODO: Mayeb for ephemeral messages we can use the flags property to DM user instead
    this._deferred = true;
    this.lastReply = await this.interaction.reply('Processing...');
    return this.lastReply;
  }

  public async editReply(data: string | MessageEditOptions) {
    return (
      (await this.lastReply?.edit(
        typeof data === 'string'
          ? { content: data }
          : { ...data, content: data.content ?? '' },
      )) ?? null
    );
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
