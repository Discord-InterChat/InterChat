import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  ContextMenuCommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { existsSync, readdirSync } from 'fs';

type CommandInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;
type InteractionFunction = (
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
) => void;

export const commandsMap = new Collection<string, Command>();
export const interactionsMap = new Collection<string, InteractionFunction | undefined>();

export default abstract class Command {
  abstract readonly data: RESTPostAPIApplicationCommandsJSONBody;
  readonly staffOnly?: boolean;
  readonly description?: string;
  // wait wtf
  static readonly subcommands?: Collection<string, Command>;

  abstract execute(interaction: CommandInteraction): Promise<unknown>;

  // optional methods
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleComponent(interaction: MessageComponentInteraction) {
    /**/
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleModal(interaction: ModalSubmitInteraction) {
    /**/
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  autocomplete(interaction: AutocompleteInteraction) {
    /**/
  }

  loadSubcommands() {
    const commandName = this.data.name;
    const fullPath = `build/commands/subcommands/${commandName}/`;
    if (!existsSync(fullPath)) return;

    readdirSync(fullPath)
      .forEach(async (file) => {
        if (file.endsWith('.js')) {
          const subcommandFile = (await import(`../commands/subcommands/${commandName}/${file}`)).default;
          const subcommandInstance = new subcommandFile() as Command;
          const parentCommand = Object.getPrototypeOf(subcommandInstance.constructor);

          // create a new instance of the subcommand class
          // and set it in the subcommands map of the parent command
          parentCommand.subcommands.set(file.replace('.js', ''), subcommandInstance);
        }
      });
  }

  /** Save command to the `clientCommands` map */
  loadCommand() {
    commandsMap.set(this.data.name, this);
  }
}
