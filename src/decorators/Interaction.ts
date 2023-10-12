import { interactionsMap } from '../commands/Command.js';

// Decorator function to call a specified method on interactionCreate
export function ComponentInteraction(customId: string): MethodDecorator {
  return function(
    targetClass: Record<string, any>,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    interactionsMap.set(customId, originalMethod);
  };
}

