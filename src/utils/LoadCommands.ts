import { join, dirname } from 'path';
import { access, constants, readdir, stat } from 'fs/promises';
import { fileURLToPath } from 'url';
import BaseCommand, { commandsMap } from '../core/BaseCommand.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Recursively loads all command files from the given directory and its subdirectories.
 * @param commandDir The directory to load command files from.
 */
const loadCommandFiles = async (commandDir = join(__dirname, '..', 'commands')) => {
  const importPrefix = process.platform === 'win32' ? 'file://' : '';
  const files = await readdir(commandDir);

  for (const file of files) {
    const filePath = join(commandDir, file);
    const stats = await stat(filePath);

    // If the item is a directory, recursively read its files
    if (stats.isDirectory()) {
      await loadCommandFiles(filePath);
    }
    else if (file.endsWith('.js')) {
      const imported = await import(importPrefix + filePath);
      const command: BaseCommand = new imported.default();

      // if the command extends BaseCommand (ie. is not a subcommand), add it to the commands map
      if (Object.getPrototypeOf(command.constructor) === BaseCommand) {
        commandsMap.set(command.data.name, command);
      }

      // if the command has subcommands, add them to the parent command's subcommands map
      else {
        const subcommandFile = join(commandDir, '.', 'index.js');
        if (!(await stat(subcommandFile)).isFile()) return;

        await access(subcommandFile, constants.F_OK).catch((err) => {
          if (err || file === 'index.js') return;

          // get the parent command class from the subcommand
          const parentCommand = Object.getPrototypeOf(command.constructor);
          // set the subcommand class to the parent command's subcommands map
          parentCommand.subcommands.set(file.replace('.js', ''), command);
        });
      }
    }
  }
};

export default loadCommandFiles;
