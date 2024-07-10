import { InteractionFunction } from '#main/decorators/Interaction.js';
import Logger from '#main/utils/Logger.js';
import {
  type ChatInputCommandInteraction,
  Collection,
  type ContextMenuCommandInteraction,
} from 'discord.js';
import { readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import BaseCommand from '#main/core/BaseCommand.js';
export type CmdInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;

export const commandsMap = new Collection<string, BaseCommand>();
export const interactionsMap = new Collection<string, InteractionFunction | undefined>();

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Recursively loads all command files from the given directory and its subdirectories.
 * @param commandDir The directory to load command files from.
 */
const loadCommandFiles = async (commandDir = join(__dirname, '..', 'commands')) => {
  Logger.debug(`Called loadCommandFiles with directory: ${commandDir}`); // Log function call
  const importPrefix = process.platform === 'win32' ? 'file://' : '';

  try {
    const files = readdirSync(commandDir);
    for (const file of files) {
      const filePath = join(commandDir, file);
      const stats = statSync(filePath);

      // If the item is a directory, recursively read its files
      if (stats.isDirectory()) {
        Logger.debug(`Entering directory: ${filePath}`); // Log directory entry
        await loadCommandFiles(filePath);
      }
      else if (file.endsWith('.js') && file !== 'BaseCommand.js') {
        Logger.debug(`Importing command file: ${filePath}`); // Log file import
        const imported = await import(importPrefix + filePath);
        const command: BaseCommand = new imported.default();

        // If the command extends BaseCommand (i.e., is not a subcommand), add it to the commands map
        if (Object.getPrototypeOf(command.constructor) === BaseCommand) {
          Logger.debug(`Adding command: ${command.data.name}`); // Log command addition
          commandsMap.set(command.data.name, command);
        }
        else {
          const subcommandFile = join(commandDir, '.', 'index.js');
          try {
            if (statSync(subcommandFile).isFile()) {
              const parentCommand = Object.getPrototypeOf(command.constructor);
              parentCommand.subcommands.set(file.replace('.js', ''), command);
            }
          }
          catch (err) {
            // Handle error if subcommandFile does not exist or is not a file
            if (err.code !== 'ENOENT') throw err;
          }
        }
      }
    }
    Logger.debug(`Finished loading commands from: ${commandDir}`); // Log completion
  }
  catch (error) {
    Logger.error(`Error loading command files from ${commandDir}:`, error); // Log any errors
  }
};

export default loadCommandFiles;
