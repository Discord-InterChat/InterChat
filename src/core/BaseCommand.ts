import { emojis } from '#main/config/Constants.js';
import { MetadataHandler } from '#main/core/FileLoader.js';
import { InteractionFunction } from '#main/decorators/Interaction.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { supportedLocaleCodes, t } from '#main/utils/Locale.js';
import Logger from '#main/utils/Logger.js';
import { getReplyMethod } from '#main/utils/Utils.js';
import {
  type ActionRowData,
  type APIActionRowComponent,
  type APIApplicationCommandSubcommandGroupOption,
  type APIApplicationCommandSubcommandOption,
  type APIMessageActionRowComponent,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type ColorResolvable,
  type ContextMenuCommandInteraction,
  type InteractionResponse,
  type JSONEncodable,
  type Message,
  type MessageActionRowComponentBuilder,
  type MessageActionRowComponentData,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
  Collection,
  time,
} from 'discord.js';

export type CmdInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;
export type CmdData =
  | RESTPostAPIChatInputApplicationCommandsJSONBody
  | RESTPostAPIContextMenuApplicationCommandsJSONBody
  | APIApplicationCommandSubcommandGroupOption
  | APIApplicationCommandSubcommandOption;

export default abstract class BaseCommand {
  abstract readonly data: CmdData;
  readonly staffOnly?: boolean;
  readonly cooldown?: number;
  readonly description?: string;
  static readonly subcommands?: Collection<string, BaseCommand>;

  abstract execute(interaction: CmdInteraction): Promise<unknown>;

  // optional methods
  async autocomplete?(interaction: AutocompleteInteraction): Promise<unknown>;
  async handleComponents?(interaction: MessageComponentInteraction): Promise<unknown>;
  async handleModals?(interaction: ModalSubmitInteraction): Promise<unknown>;

  async checkOrSetCooldown(interaction: RepliableInteraction): Promise<boolean> {
    const remainingCooldown = await this.getRemainingCooldown(interaction);

    if (remainingCooldown) {
      const { userManager } = interaction.client;
      const locale = await userManager.getUserLocale(interaction.user.id);
      await this.sendCooldownError(interaction, remainingCooldown, locale);
      return true;
    }

    await this.setUserCooldown(interaction);
    return false;
  }

  async sendCooldownError(
    interaction: RepliableInteraction,
    remainingCooldown: number,
    locale: supportedLocaleCodes,
  ): Promise<void> {
    const waitUntil = Math.round((Date.now() + remainingCooldown) / 1000);

    await interaction.reply({
      content: t(
        { phrase: 'errors.cooldown', locale },
        { time: `${time(waitUntil, 'T')} (${time(waitUntil, 'R')})`, emoji: emojis.no },
      ),
      ephemeral: true,
    });
  }

  async getRemainingCooldown(interaction: RepliableInteraction): Promise<number> {
    let remainingCooldown: number | undefined;
    const { commandCooldowns } = interaction.client;

    if (interaction.isChatInputCommand()) {
      const subcommand = interaction.options.getSubcommand(false);
      const subcommandGroup = interaction.options.getSubcommandGroup(false);

      remainingCooldown = await commandCooldowns.getRemainingCooldown(
        `${interaction.user.id}-${interaction.commandName}${
          subcommandGroup ? `-${subcommandGroup}` : ''
        }${subcommand ? `-${subcommand}` : ''}`,
      );
    }
    else if (interaction.isContextMenuCommand()) {
      remainingCooldown = await commandCooldowns.getRemainingCooldown(
        `${interaction.user.id}-${interaction.commandName}`,
      );
    }

    return remainingCooldown || 0;
  }

  async setUserCooldown(interaction: RepliableInteraction): Promise<void> {
    if (!this.cooldown) return;
    const { commandCooldowns } = interaction.client;

    if (interaction.isChatInputCommand()) {
      const subcommand = interaction.options.getSubcommand(false);
      const subcommandGroup = interaction.options.getSubcommandGroup(false);
      const id = `${interaction.user.id}-${interaction.commandName}${
        subcommandGroup ? `-${subcommandGroup}` : ''
      }${subcommand ? `-${subcommand}` : ''}`;

      await commandCooldowns.setCooldown(id, this.cooldown);
    }
    else if (interaction.isContextMenuCommand()) {
      await commandCooldowns.setCooldown(
        `${interaction.user.id}-${interaction.commandName}`,
        this.cooldown,
      );
    }
  }

  async replyEmbed(
    interaction: RepliableInteraction | MessageComponentInteraction,
    desc: string,
    opts?: {
      content?: string;
      title?: string;
      color?: ColorResolvable;
      components?: readonly (
        | JSONEncodable<APIActionRowComponent<APIMessageActionRowComponent>>
        | ActionRowData<MessageActionRowComponentData | MessageActionRowComponentBuilder>
        | APIActionRowComponent<APIMessageActionRowComponent>
      )[];
      ephemeral?: boolean;
      edit?: boolean;
    },
  ): Promise<InteractionResponse | Message> {
    const embed = new InfoEmbed().setDescription(desc).setTitle(opts?.title);
    const message = { content: opts?.content, embeds: [embed], components: opts?.components };

    if (opts?.edit) return await interaction.editReply(message);

    const methodName = getReplyMethod(interaction);
    return await interaction[methodName]({ ...message, ephemeral: opts?.ephemeral });
  }

  async build(
    fileName: string,
    opts: {
      commandsMap: Collection<string, BaseCommand>;
      interactionsMap: Collection<string, InteractionFunction>;
    },
  ): Promise<void> {
    if (Object.getPrototypeOf(this.constructor) === BaseCommand) {
      opts.commandsMap.set(this.data.name, this);
      this.loadCommandInteractions(this, opts.interactionsMap);
    }
    else {
      const parentCommand = Object.getPrototypeOf(this.constructor) as typeof BaseCommand;
      parentCommand.subcommands?.set(fileName.replace('.js', ''), this);
      this.loadCommandInteractions(this, opts.interactionsMap);
    }
  }

  private async loadCommandInteractions(
    command: BaseCommand,
    map: Collection<string, InteractionFunction>,
  ): Promise<void> {
    Logger.debug(`Adding interactions for command: ${command.data.name}`);
    MetadataHandler.loadMetadata(command, map);
    Logger.debug(`Finished adding interactions for command: ${command.data.name}`);
  }
}
