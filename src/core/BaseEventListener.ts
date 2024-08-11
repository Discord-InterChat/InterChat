import { Awaitable, ClientEvents } from 'discord.js';

export type EventParams = {
  [K in keyof ClientEvents]: ClientEvents[K];
};

export default abstract class BaseEventListener<K extends keyof ClientEvents> {
  abstract name: K;

  abstract execute(...args: EventParams[K]): Awaitable<void>;
}
