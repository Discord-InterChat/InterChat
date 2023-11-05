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

type CommandInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;

export const commandsMap = new Collection<string, BaseCommand>();
export const interactionsMap = new Collection<string, InteractionFunction | undefined>();

export default abstract class BaseCommand {
  abstract readonly data: RESTPostAPIApplicationCommandsJSONBody;
  readonly staffOnly?: boolean;
  readonly cooldown?: number;
  readonly description?: string;
  static readonly subcommands?: Collection<string, BaseCommand>;

  abstract execute(interaction: CommandInteraction): Promise<unknown>;

  // optional methods
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleComponents(interaction: MessageComponentInteraction) {
    /**/
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleModals(interaction: ModalSubmitInteraction) {
    /**/
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  autocomplete(interaction: AutocompleteInteraction) {
    /**/
  }
}
