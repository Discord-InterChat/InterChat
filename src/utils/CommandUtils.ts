import type BaseCommand from '#main/core/BaseCommand.js';
import { type InteractionFunction } from '#main/decorators/Interaction.js';
import { CommandLoader } from '#main/modules/Loaders/CommandLoader.js';
import { InteractionLoader } from '#main/modules/Loaders/InteractionLoader.js';
import {
  ApplicationCommandOptionType,
  type ApplicationCommand,
  type ChatInputCommandInteraction,
  type Client,
  type Collection,
  type ContextMenuCommandInteraction,
  type GuildResolvable,
} from 'discord.js';

export type CmdInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;

export const loadInteractions = async (map: Collection<string, InteractionFunction>) => {
  const loader = new InteractionLoader(map);
  await loader.load();
};

/**
 * Recursively loads all command files from the given directory and its subdirectories.
 * @param commandDir The directory to load command files from.
 */
export const loadCommandFiles = async (
  map: Collection<string, BaseCommand>,
  interactionsMap: Collection<string, InteractionFunction>,
) => {
  const loader = new CommandLoader(map, interactionsMap);
  await loader.load();
};

export const fetchCommands = async (client: Client) => await client.application?.commands.fetch();

export const findCommand = (
  name: string,
  commands:
    | Collection<
      string,
      ApplicationCommand<{
        guild: GuildResolvable;
      }>
    >
    | undefined,
) => commands?.find((command) => command.name === name);

export const findSubcommand = (
  cmdName: string,
  subName: string,
  commands: Collection<
    string,
    ApplicationCommand<{
      guild: GuildResolvable;
    }>
  >,
) => {
  const command = commands.find(({ name }) => name === cmdName);
  return command?.options.find(
    ({ type, name }) => type === ApplicationCommandOptionType.Subcommand && name === subName,
  );
};