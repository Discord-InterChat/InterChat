import { MessageComponentInteraction, ModalSubmitInteraction } from 'discord.js';
import { interactionsMap } from '../core/BaseCommand.js';

export type InteractionFunction = (
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
) => Promise<unknown>;

/** Decorator to call a specified method when an interaction is created (ie. interactionCreate event) */
export function RegisterInteractionHandler(prefix: string, suffix = ''): MethodDecorator {
  return function(targetClass, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as InteractionFunction;
    const realSuffix = suffix ? `:${suffix}` : '';

    // NOTE: It is not possible to access other class properties for decorator methods
    // so don't try to access `this.<property>` in any decorator method body
    interactionsMap.set(`${prefix}${realSuffix}`, originalMethod);
  };
}
