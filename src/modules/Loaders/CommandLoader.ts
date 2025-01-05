import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client, Collection } from 'discord.js';
import type BaseCommand from '#main/core/BaseCommand.js';
import BasePrefixCommand from '#main/core/BasePrefixCommand.js';
import { type Class, FileLoader, type ResourceLoader } from '#main/core/FileLoader.js';
import type { InteractionFunction } from '#main/decorators/RegisterInteractionHandler.js';
import Logger from '#utils/Logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class CommandLoader implements ResourceLoader {
  private readonly commandMap: Collection<string, BaseCommand>;
  private readonly prefixMap: Collection<string, BasePrefixCommand>;
  private readonly interactionsMap: Collection<string, InteractionFunction>;
  private readonly fileLoader: FileLoader;
  private readonly client: Client | null;

  constructor(
    commandMap: Collection<string, BaseCommand>,
    prefixMap: Collection<string, BasePrefixCommand>,
    interactionsMap: Collection<string, InteractionFunction>,
    client: Client | null,
  ) {
    this.prefixMap = prefixMap;
    this.commandMap = commandMap;
    this.interactionsMap = interactionsMap;
    this.fileLoader = new FileLoader(join(__dirname, '..', '..', 'commands'), {
      recursive: true,
    });
    this.client = client;
  }

  async load(): Promise<void> {
    await this.fileLoader.loadFiles(this.processFile.bind(this));
  }

  private async processFile(filePath: string): Promise<void> {
    Logger.debug(`Importing command file: ${filePath}`);
    const imported = await FileLoader.import<{
      default: Class<BaseCommand | BasePrefixCommand>;
    }>(filePath);
    const command = new imported.default(this.client);
    const fileName = filePath.replaceAll('\\', '/').split('/').pop() as string;

    if (command instanceof BasePrefixCommand) {
      this.prefixMap.set(command.data.name, command);
    }
    else {
      command.build(fileName.replace('.ts', ''), {
        commandsMap: this.commandMap,
        interactionsMap: this.interactionsMap,
      });
    }
    Logger.debug(`Finished loading command: ${command.data.name}`);
  }
}

export interface ICommand {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly cooldown?: number;
  readonly staffOnly?: boolean;
  readonly type: 'prefix' | 'slash' | 'context';
}
