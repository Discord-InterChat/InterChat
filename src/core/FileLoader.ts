import { type InteractionFunction } from '#main/decorators/RegisterInteractionHandler.js';
import Logger from '#utils/Logger.js';
import {
  Awaitable,
  Collection,
  type ChatInputCommandInteraction,
  type ContextMenuCommandInteraction,
} from 'discord.js';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import 'reflect-metadata';

export type CmdInteraction = ChatInputCommandInteraction | ContextMenuCommandInteraction;
export type Class<T extends object = { constructor: object }> = new (...args: unknown[]) => T;
export interface ResourceLoader {
  load(): Promise<void>;
}

const importPrefix = process.platform === 'win32' ? 'file://' : '';

export class MetadataHandler {
  static getMetadata(target: { constructor: object }): { customId: string; methodName: string }[] {
    return Reflect.getMetadata('interactions', target.constructor) || [];
  }

  static loadMetadata(
    target: { constructor: object },
    map: Collection<string, InteractionFunction>,
  ): void {
    const metadata = this.getMetadata(target);
    metadata.forEach(({ customId, methodName }) => {
      Logger.debug(`Adding interaction: ${customId} with method ${methodName}`);
      // @ts-expect-error The names of child class properties can be custom
      const method: InteractionFunction = target[methodName];
      if (method) map.set(customId, method.bind(target));
    });
  }
}

export class FileLoader {
  private readonly baseDir: string;
  private readonly recursive: boolean;

  constructor(baseDir: string, opts?: { recursive: boolean }) {
    this.baseDir = baseDir;
    this.recursive = opts?.recursive ?? false;
  }

  async loadFiles(processor: (filePath: string) => Awaitable<void>): Promise<void> {
    await this.processDirectory(this.baseDir, processor);
  }

  private async processDirectory(
    dir: string,
    processor: (filePath: string) => Awaitable<void>,
  ): Promise<void> {
    Logger.debug(`Processing directory: ${dir}`);
    const files = await readdir(dir);
    for (const file of files) {
      const filePath = join(dir, file);
      const stats = await stat(filePath);
      if (stats.isDirectory() && this.recursive) {
        await this.processDirectory(filePath, processor);
      }
      else if (file.endsWith('.js')) {
        await processor(filePath);
      }
    }
  }

  static async import<T>(filePath: string): Promise<T> {
    return await import(importPrefix + filePath);
  }
}
