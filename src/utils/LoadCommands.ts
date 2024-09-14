import 'reflect-metadata';
import BaseCommand from '#main/core/BaseCommand.js';
import { type InteractionFunction } from '#main/decorators/Interaction.js';
import Logger from '#main/utils/Logger.js';
import {
  type ChatInputCommandInteraction,
  type ContextMenuCommandInteraction,
  Collection,
} from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export type CmdInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;

export const commandsMap = new Collection<string, BaseCommand>();
export const interactionsMap = new Collection<string, InteractionFunction | undefined>();

const __dirname = dirname(fileURLToPath(import.meta.url));
const importPrefix = process.platform === 'win32' ? 'file://' : '';

const loadCommandInteractions = (command: BaseCommand) => {
  Logger.debug(`Adding interactions for command: ${command.data.name}`);

  const metadata = Reflect.getMetadata('command:interactions', command.constructor) as
    | { customId: string; methodName: string }[]
    | undefined;
  if (!metadata?.length) return;

  metadata.forEach(({ customId, methodName }) => {
    Logger.debug(`Adding interaction: ${customId} with method ${methodName}`);

    // @ts-expect-error The names of child class properties can be custom
    const method: InteractionFunction = command[methodName];

    interactionsMap.set(customId, method.bind(command));
  });

  Logger.debug(`Finished adding interactions for command: ${command.data.name}`);
};

const loadCommand = (command: BaseCommand) => {
  Logger.debug(`Adding command: ${command.data.name}`);
  commandsMap.set(command.data.name, command);
};

const loadSubCommand = (command: BaseCommand, opts: { fileName: string }) => {
  const parentCommand = Object.getPrototypeOf(command.constructor);
  parentCommand.subcommands.set(opts.fileName.replace('.js', ''), command);
};

/**
 * Recursively loads all command files from the given directory and its subdirectories.
 * @param commandDir The directory to load command files from.
 */
export const loadCommandFiles = async (opts?: {
  commandDir?: string;
  loadInteractions?: boolean;
}) => {
  const commandDir = opts?.commandDir ?? join(__dirname, '..', 'commands');
  const loadInteractions = Boolean(opts?.loadInteractions);

  Logger.debug(`Called loadCommandFiles with directory: ${commandDir}`);

  try {
    const filesInDir = readdirSync(commandDir);
    for (const fileName of filesInDir) {
      const filePath = join(commandDir, fileName);
      const stats = statSync(filePath);

      // If the item is a directory, recursively read its files
      if (stats.isDirectory()) {
        Logger.debug(`Entering directory: ${filePath}`);
        await loadCommandFiles({ commandDir: filePath, loadInteractions });
      }
      else if (fileName.endsWith('.js')) {
        Logger.debug(`Importing command file: ${filePath}`);
        const imported = await import(importPrefix + filePath);
        const command: BaseCommand = new imported.default();

        // load the commands
        if (Object.getPrototypeOf(command.constructor) === BaseCommand) loadCommand(command);
        else loadSubCommand(command, { fileName });

        // load related button/select/modal etc. interaction listeners
        if (loadInteractions) loadCommandInteractions(command);
      }
    }
    Logger.debug(`Finished loading commands from: ${commandDir}`);
  }
  catch (error) {
    Logger.error(`Error loading command files from ${commandDir}:`, error);
  }

  return commandsMap;
};
