import BaseEventListener from '#main/core/BaseEventListener.js';
import Factory from '#main/core/Factory.js';
import { ClientEvents, Collection } from 'discord.js';
import { readdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const importPrefix = process.platform === 'win32' ? 'file://' : '';

export default class EventHandler extends Factory {
  private listeners: Map<string, BaseEventListener<keyof ClientEvents>> = new Collection();

  /** Loads all event listeners from the 'events' directory. */
  public async loadListeners(): Promise<void> {
    const listenersPath = join(__dirname, '..', 'events');
    const files = await readdir(listenersPath);

    files.forEach(async (file) => {
      if (!file.endsWith('.js')) return;

      const { default: Listener } = await import(importPrefix + join(listenersPath, file));
      const listenerInstance: BaseEventListener<keyof ClientEvents> = new Listener();
      this.registerListener(listenerInstance);
    });
  }

  private registerListener(listener: BaseEventListener<keyof ClientEvents>): void {
    this.listeners.set(listener.name, listener);
    this.client.on(listener.name, (...args) => listener.execute(...args));
  }
}
