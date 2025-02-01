import {
  type Class,
  FileLoader,
  loadMetadata,
  type ResourceLoader,
} from '#src/core/FileLoader.js';
import type { InteractionFunction } from '#src/decorators/RegisterInteractionHandler.js';
import Logger from '#utils/Logger.js';
import type { Collection } from 'discord.js';
import { join } from 'node:path';

const __dirname = new URL('.', import.meta.url).pathname;
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
    loadMetadata(interactionHandler, this.map);
  }
}
