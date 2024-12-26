import { EmojiKeys, getEmoji } from '#main/utils/EmojiUtils.js';
import { Awaitable, Client, ClientEvents } from 'discord.js';

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
