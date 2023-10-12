import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  ContextMenuCommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';

type CommandInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;
type InteractionFunction = (
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
) => void;

export interface CommandOptions {
  readonly data: RESTPostAPIApplicationCommandsJSONBody;
  readonly staffOnly?: boolean;
  readonly description?: string;
  readonly execute: (interaction: CommandInteraction) => Promise<unknown>;
  readonly autocomplete?: (interaction: AutocompleteInteraction) => Promise<unknown>;
}

export const commandsMap = new Collection<string, CommandOptions>();
export const interactionsMap = new Collection<string, InteractionFunction | undefined>();

export default abstract class Command {
  abstract readonly data: RESTPostAPIApplicationCommandsJSONBody;
  readonly staffOnly?: boolean;
  readonly description?: string;

  abstract execute(interaction: CommandInteraction): Promise<unknown>;

  // optional methods
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleComponent(interaction: MessageComponentInteraction): void {
    /**/
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleModal(interaction: ModalSubmitInteraction): void {
    /**/
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  autocomplete(interaction: AutocompleteInteraction): void {
    /**/
  }

  loadCommand() {
    // Save command to the `clientCommands` map
    commandsMap.set(this.data.name, this.toJSON());
  }

  toJSON() {
    return {
      data: this.data,
      staffOnly: this.staffOnly,
      description: this.description,
      execute: this.execute,
      autocomplete: this.autocomplete,
    } as CommandOptions;
  }
}
