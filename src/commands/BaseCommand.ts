import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  ContextMenuCommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { InteractionFunction } from '../decorators/Interaction.js';

export type CmdInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;

export const commandsMap = new Collection<string, BaseCommand>();
export const interactionsMap = new Collection<string, InteractionFunction | undefined>();

export default abstract class BaseCommand {
  abstract readonly data: RESTPostAPIApplicationCommandsJSONBody;
  readonly staffOnly?: boolean;
  readonly cooldown?: number;
  readonly description?: string;
  static readonly subcommands?: Collection<string, BaseCommand>;

  abstract execute(interaction: CmdInteraction): Promise<unknown>;

  // optional methods
  async handleComponents?(interaction: MessageComponentInteraction): Promise<unknown>;
  async handleModals?(interaction: ModalSubmitInteraction): Promise<unknown>;
  async autocomplete?(interaction: AutocompleteInteraction): Promise<unknown>;
}
