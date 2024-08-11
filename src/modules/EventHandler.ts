import Factory from '#main/core/Factory.js';
import BaseEventListener from '#main/core/BaseEventListener.js';
import { ClientEvents, Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const importPrefix = process.platform === 'win32' ? 'file://' : '';

export default class EventHandler extends Factory {
  private listeners: Map<string, BaseEventListener<keyof ClientEvents>> = new Collection();

  async loadListeners(): Promise<void> {
    const listenersPath = join(__dirname, '..', 'events');
    const files = readdirSync(listenersPath).filter((file) => file.endsWith('.js'));

    files.forEach(async (file) => {
      const { default: Listener } = (await import(importPrefix + join(listenersPath, file)));
      const listenerInstance: BaseEventListener<keyof ClientEvents> = new Listener();
      this.registerListener(listenerInstance);
    });
  }

  private registerListener(listener: BaseEventListener<keyof ClientEvents>): void {
    this.listeners.set(listener.name, listener);
    this.client.on(listener.name, (...args) => listener.execute(...args));
  }
}
