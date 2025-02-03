import BaseCommand from '#src/core/BaseCommand.js';
import { loadMetadata } from '#src/core/FileLoader.js';
import type { InteractionFunction } from '#src/decorators/RegisterInteractionHandler.js';
import type { Collection } from 'discord.js';
import isEmpty from 'lodash/isEmpty.js';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;

export const loadCommands = async (
  map: Collection<string, BaseCommand>,
  interactionMap?: Collection<string, InteractionFunction>,
  depth = 0,
  dirName?: string,
) => {
  const path = join(__dirname, '..', `commands${dirName ? `/${dirName}` : ''}`);
  const files = await readdir(join(path));

  for (const file of files) {
    if (file.endsWith('.js')) {
      if (depth > 1 && file !== 'index.js') {
        continue;
      }

      const { default: Command } = await import(`${path}/${file}`);
      if (Command.prototype instanceof BaseCommand) {
        const command: BaseCommand = new Command();
        map.set(command.name, command);
        if (interactionMap) loadInteractionsForCommand(command, interactionMap);
      }
    }

    const stats = await stat(join(path, file));
    if (stats.isDirectory()) {
      // Recursively load commands from subdirectories
      await loadCommands(
        map,
        interactionMap,
        depth + 1,
        dirName ? join(dirName, file) : file,
      );
    }
  }
};

export const loadInteractionsForCommand = async (
  command: BaseCommand,
  interactionMap: Collection<string, InteractionFunction>,
) => {
  if (!isEmpty(command.subcommands)) {
    for (const subcommand of Object.values(command.subcommands)) {
      loadMetadata(subcommand, interactionMap);
    }
  }

  loadMetadata(command, interactionMap);
};
