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
import { InteractionFunction } from '../decorators/Interaction.js';

type CommandInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;

export const commandsMap = new Collection<string, BaseCommand>();
export const interactionsMap = new Collection<string, InteractionFunction | undefined>();

export default abstract class BaseCommand {
  abstract readonly data: RESTPostAPIApplicationCommandsJSONBody;
  readonly staffOnly?: boolean;
  readonly description?: string;
  // wait wtf
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

  loadSubcommands() {
    const commandName = this.data.name;
    const fullPath = `build/commands/subcommands/${commandName}/`;
    if (!existsSync(fullPath)) return;

    readdirSync(fullPath).forEach(async (file) => {
      if (file.endsWith('.js')) {
        const subcommandFile = await import(`../commands/subcommands/${commandName}/${file}`);
        const subcommandInstance: BaseCommand = subcommandFile.default
          ? new subcommandFile.default()
          : new subcommandFile();
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
