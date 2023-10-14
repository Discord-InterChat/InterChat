import { interactionsMap } from '../commands/Command.js';

// Decorator function to call a specified method on interactionCreate
export function ComponentInteraction(customId: string): MethodDecorator {
  return function(
    targetClass: Record<string, any>,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    // NOTE: It is not possible to access other class properties for decorator methods
    // so don't try to access `this.<property>` in any decorator method body
    interactionsMap.set(customId, originalMethod);
  };
}

