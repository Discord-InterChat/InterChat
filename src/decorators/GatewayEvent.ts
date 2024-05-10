import { ClientEvents, Collection } from 'discord.js';

type EventCallback = (...args: unknown[]) => unknown | Promise<unknown>;

export const eventMethods = new Collection<string, EventCallback[]>();

// Decorator to mark methods as event listeners
export default function GatewayEvent(eventName: keyof ClientEvents): MethodDecorator {
  return function(_target, _key: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as EventCallback;

    let values: EventCallback[] = [originalMethod];
    if (eventMethods.has(eventName)) {
      values = eventMethods.get(eventName) ?? [];
      values.push(originalMethod);
    }

    eventMethods.set(eventName, values);
  };
}
