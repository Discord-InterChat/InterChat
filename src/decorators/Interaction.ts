import type { Awaitable, MessageComponentInteraction, ModalSubmitInteraction } from 'discord.js';
import 'reflect-metadata';

export type InteractionFunction = (
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
) => Awaitable<unknown>;

/** Decorator to call a specified method when an interaction is created (ie. interactionCreate event) */
export function RegisterInteractionHandler(prefix: string, suffix = ''): MethodDecorator {
  return function(targetClass, propertyKey: string | symbol) {
    const realSuffix = suffix ? `:${suffix}` : '';
    const customId = `${prefix}${realSuffix}`;

    const newMeta = [{ customId, methodName: propertyKey }];
    const existing = Reflect.getMetadata('interactions', targetClass.constructor);

    const metadata = existing ? [...existing, ...newMeta] : newMeta;
    Reflect.defineMetadata('interactions', metadata, targetClass.constructor);
    return;
  };
}
