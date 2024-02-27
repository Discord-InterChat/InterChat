import { MessageComponentInteraction, ModalSubmitInteraction } from 'discord.js';
import { interactionsMap } from '../core/BaseCommand.js';

export type InteractionFunction = (
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
) => Promise<unknown>;

/** Decorator function to call a specified method when an interaction is created (ie. interactionCreate event) */
export function RegisterInteractionHandler(customId: string): MethodDecorator {
  return function (targetClass, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as InteractionFunction;
    // NOTE: It is not possible to access other class properties for decorator methods
    // so don't try to access `this.<property>` in any decorator method body
    interactionsMap.set(customId, originalMethod);
  };
}
