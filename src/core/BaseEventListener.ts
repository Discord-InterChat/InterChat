import type { Awaitable, Client, ClientEvents } from 'discord.js';
import { type EmojiKeys, getEmoji } from '#src/utils/EmojiUtils.js';

export type EventParams = {
  [K in keyof ClientEvents]: ClientEvents[K];
};

export default abstract class BaseEventListener<K extends keyof ClientEvents> {
  abstract name: K;

  protected readonly client: Client | null;

  constructor(client: Client | null) {
    this.client = client;
  }

  protected getEmoji(name: EmojiKeys): string {
    if (!this.client?.isReady()) return '';
    return getEmoji(name, this.client);
  }

  abstract execute(...args: EventParams[K]): Awaitable<void>;
}
