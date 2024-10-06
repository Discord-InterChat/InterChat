import BaseCommand from '#main/core/BaseCommand.js';
import { type Class, FileLoader, type ResourceLoader } from '#main/core/FileLoader.js';
import { InteractionFunction } from '#main/decorators/Interaction.js';
import Logger from '#main/utils/Logger.js';
import { Collection } from 'discord.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class CommandLoader implements ResourceLoader {
  private readonly map: Collection<string, BaseCommand>;
  private readonly interactionsMap: Collection<string, InteractionFunction>;
  private readonly fileLoader: FileLoader;

  constructor(
    map: Collection<string, BaseCommand>,
    interactionsMap: Collection<string, InteractionFunction>,
  ) {
    this.map = map;
    this.interactionsMap = interactionsMap;
    this.fileLoader = new FileLoader(join(__dirname, '..', '..', 'commands'), { recursive: true });
  }

  async load(): Promise<void> {
    await this.fileLoader.loadFiles(this.processFile.bind(this));
  }

  private async processFile(filePath: string): Promise<void> {
    Logger.debug(`Importing command file: ${filePath}`);
    const imported = await FileLoader.import<{ default: Class<BaseCommand> }>(filePath);
    const command = new imported.default();
    const fileName = filePath.replaceAll('\\', '/').split('/').pop() as string;

    command.build(fileName.replace('.js', ''), {
      commandsMap: this.map,
      interactionsMap: this.interactionsMap,
    });
    Logger.debug(`Finished loading command: ${command.data.name}`);
  }
}
