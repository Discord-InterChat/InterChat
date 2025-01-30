import type Context from '#src/core/CommandContext/Context.js';
import {
  type APIApplicationCommandBasicOption,
  ApplicationCommandOptionType,
  type ApplicationCommandStringOption,
  type ApplicationCommandType,
  ApplicationIntegrationType,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  type ContextMenuCommandInteraction,
  InteractionContextType,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type RESTPostAPIContextMenuApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import isEmpty from 'lodash/isEmpty.js';

export const createStringOption = (
  data: Omit<ApplicationCommandStringOption, 'type'>,
) => ({ ...data, type: ApplicationCommandOptionType.String });

export type CmdInteraction =
	| ChatInputCommandInteraction
	| ContextMenuCommandInteraction;
export type CmdData =
	| RESTPostAPIChatInputApplicationCommandsJSONBody
	| RESTPostAPIContextMenuApplicationCommandsJSONBody;

interface Config {
  name: string;
  description: string;
  staffOnly?: boolean;
  contexts?: { guildOnly?: boolean; userInstall?: boolean };
  options?: APIApplicationCommandBasicOption[];
  defaultPermission?: string; // TODO: implent this, make this bigint for easier bitwise operations
}

interface CommandConfig extends Config {
  types: {
    slash?: boolean;
    prefix?: boolean;
    contextMenu?: never;
  };
  subcommands?: Record<string, BaseCommand | Record<string, BaseCommand>>;
}

interface ContextMenuConfig extends Config {
  types: {
    slash?: boolean;
    prefix?: boolean;
    contextMenu: {
      name: string;
      type: ApplicationCommandType.Message | ApplicationCommandType.User;
    };
  };
  subcommands?: never;
}

export default abstract class BaseCommand {
  readonly name: CommandConfig['name'];
  readonly description: CommandConfig['description'];
  readonly types: CommandConfig['types'] | ContextMenuConfig['types'];
  readonly contexts: CommandConfig['contexts'];
  readonly staffOnly: boolean;

  // if contextMenu has been set to "Message" options should only contain one sring option
  // which is assumed to be the id of the target message
  // same thing for user ctx menu, user option must be used
  readonly options: APIApplicationCommandBasicOption[];
  readonly subcommands: CommandConfig['subcommands'];

  constructor(opts: ContextMenuConfig | CommandConfig) {
    this.name = opts.name;
    this.description = opts.description;
    this.types = opts.types;
    this.contexts = opts.contexts;
    this.options = opts.options || [];
    this.subcommands = 'subcommands' in opts ? opts.subcommands : undefined;
    this.staffOnly = opts.staffOnly || false;
  }

  async execute?(ctx: Context): Promise<void>;
  async autocomplete?(interaction: AutocompleteInteraction): Promise<void>;

  getData() {
    let slashCommand: RESTPostAPIChatInputApplicationCommandsJSONBody | null =
			null;
    let prefixCommand: Omit<CommandConfig, 'types'> | null = null;
    let contextMenu: RESTPostAPIContextMenuApplicationCommandsJSONBody | null =
			null;

    if (this.options.length > 0 && !isEmpty(this.subcommands)) {
      throw new Error(
        `Command "${this.name}" is invalid. A command must either have subcommands or options. Not both.`,
      );
    }


    if (this.types.slash) {
      slashCommand = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription(this.description)
        .setIntegrationTypes(
          this.contexts?.userInstall
            ? ApplicationIntegrationType.UserInstall
            : ApplicationIntegrationType.GuildInstall,
        )
        .toJSON();

      if (!isEmpty(this.options)) {
        slashCommand.options = this.options;
      }
      if (this.contexts?.guildOnly) {
        slashCommand.contexts?.push(InteractionContextType.Guild);
      }

      if (!isEmpty(this.subcommands)) {
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.entries(this.subcommands).forEach(([name, data]) => {
          if (data instanceof BaseCommand) {
            slashCommand?.options?.push({
              type: ApplicationCommandOptionType.Subcommand,
              name: data.name,
              description: data.description,
              options: data.options,
            });
          }
          else {
            const subcommandGroupName = name;
            slashCommand?.options?.push({
              type: ApplicationCommandOptionType.SubcommandGroup,
              name: subcommandGroupName,
              description: 'placeholder',
              options: Object.entries(data).map(
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                ([_subcommandName, subcommandData]) => ({
                  type: ApplicationCommandOptionType.Subcommand,
                  name: subcommandData.name,
                  description: subcommandData.description,
                  options: subcommandData.options,
                }),
              ),
            });
          }
        });
      }
    }
    if (this.types.prefix) {
      prefixCommand = {
        name: this.name,
        description: this.description,
        options: this.options,
        subcommands: this.subcommands,
        contexts: this.contexts,
      };
    }
    if (this.types.contextMenu) {
      const { contextMenu: rawCtxData } = this.types;
      contextMenu = new ContextMenuCommandBuilder()
        .setName(rawCtxData.name)
        .setType(rawCtxData.type)
        .toJSON();
    }

    return { prefix: prefixCommand, contextMenu, slash: slashCommand };
  }
}
