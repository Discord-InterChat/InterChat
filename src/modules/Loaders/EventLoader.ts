import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Client, type ClientEvents, Collection } from 'discord.js';
import type InterChatClient from '#src/core/BaseClient.js';
import type BaseEventListener from '#src/core/BaseEventListener.js';
import { FileLoader } from '#src/core/FileLoader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default class EventLoader {
  private readonly listeners: Map<string, BaseEventListener<keyof ClientEvents>> = new Collection();
  private readonly client: Client;
  private readonly fileLoader: FileLoader;
  public readonly folderPath = join(__dirname, '..', '..', 'events');

  constructor(client: InterChatClient) {
    this.client = client;
    this.fileLoader = new FileLoader(this.folderPath);
  }

  /** Loads all event listeners from the `events` directory. */
  public async load(): Promise<void> {
    await this.fileLoader.loadFiles(this.registerListener.bind(this));
  }

  private async registerListener(filePath: string) {
    const { default: Listener } = await FileLoader.import<{
      default: new (client: Client) => BaseEventListener<keyof ClientEvents>;
    }>(filePath);

    const listener = new Listener(this.client);
    this.listeners.set(listener.name, listener);
    this.client.on(listener.name, listener.execute.bind(listener));
  }
}
