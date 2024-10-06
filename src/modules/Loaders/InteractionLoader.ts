import { Class, FileLoader, MetadataHandler, ResourceLoader } from '#main/core/FileLoader.js';
import { InteractionFunction } from '#main/decorators/Interaction.js';
import Logger from '#main/utils/Logger.js';
import { Collection } from 'discord.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export class InteractionLoader implements ResourceLoader {
  private readonly map: Collection<string, InteractionFunction>;
  private readonly fileLoader: FileLoader;

  constructor(map: Collection<string, InteractionFunction>) {
    this.map = map;
    this.fileLoader = new FileLoader(join(__dirname, '..', '..', 'interactions'), {
      recursive: true,
    });
  }

  async load(): Promise<void> {
    Logger.debug('Loading interactions');
    await this.fileLoader.loadFiles(this.processFile.bind(this));
    Logger.debug('Finished loading interactions');
  }

  private async processFile(filePath: string): Promise<void> {
    Logger.debug(`Importing interaction file: ${filePath}`);
    const imported = await FileLoader.import<{ default: Class }>(filePath);
    const interactionHandler = new imported.default();
    MetadataHandler.loadMetadata(interactionHandler, this.map);
  }
}
