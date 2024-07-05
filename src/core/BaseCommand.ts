import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  ContextMenuCommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  time,
  RepliableInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';
import { InteractionFunction } from '../decorators/Interaction.js';
import { t } from '../utils/Locale.js';
import { emojis } from '../utils/Constants.js';

export type CmdInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;

export const commandsMap = new Collection<string, BaseCommand>();
export const interactionsMap = new Collection<string, InteractionFunction | undefined>();

export default abstract class BaseCommand {
  abstract readonly data:
    | RESTPostAPIChatInputApplicationCommandsJSONBody
    | RESTPostAPIContextMenuApplicationCommandsJSONBody;
  readonly staffOnly?: boolean;
  readonly cooldown?: number;
  readonly description?: string;
  static readonly subcommands?: Collection<string, BaseCommand>;

  abstract execute(interaction: CmdInteraction): Promise<unknown>;

  // optional methods
  static async handleComponents?(interaction: MessageComponentInteraction): Promise<unknown>;
  static async handleModals?(interaction: ModalSubmitInteraction): Promise<unknown>;
  async autocomplete?(interaction: AutocompleteInteraction): Promise<unknown>;

  async checkAndSetCooldown(interaction: RepliableInteraction): Promise<boolean> {
    const remainingCooldown = await this.getRemainingCooldown(interaction);

    if (remainingCooldown) {
      await this.sendCooldownError(interaction, remainingCooldown);
      return true;
    }

    await this.setUserCooldown(interaction);
    return false;
  }

  async sendCooldownError(
    interaction: RepliableInteraction,
    remainingCooldown: number,
  ): Promise<void> {
    const waitUntil = Math.round((Date.now() + remainingCooldown) / 1000);

    await interaction.reply({
      content: t(
        { phrase: 'errors.cooldown', locale: interaction.user.locale },
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
}
