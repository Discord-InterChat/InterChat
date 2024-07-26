import 'reflect-metadata';
import BaseCommand from '#main/core/BaseCommand.js';
import { interactionsMap } from '#main/utils/LoadCommands.js';
import type { Awaitable, MessageComponentInteraction, ModalSubmitInteraction } from 'discord.js';

const getProto = (object: object) => Object.getPrototypeOf(object);
const extendsBase = (proto: unknown) => proto === BaseCommand;

export type InteractionFunction = (
  interaction: MessageComponentInteraction | ModalSubmitInteraction,
) => Awaitable<unknown>;

/** Decorator to call a specified method when an interaction is created (ie. interactionCreate event) */
export function RegisterInteractionHandler(prefix: string, suffix = ''): MethodDecorator {
  return function(targetClass, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const realSuffix = suffix ? `:${suffix}` : '';
    const customId = `${prefix}${realSuffix}`;

    if (
      extendsBase(getProto(targetClass.constructor)) ||
      extendsBase(getProto(getProto(targetClass.constructor)))
    ) {
      const existing = Reflect.getMetadata('command:interactions', targetClass.constructor);
      const newMeta = [{ customId, methodName: propertyKey }];
      const metadata = existing ? [...existing, ...newMeta] : newMeta;
      Reflect.defineMetadata('command:interactions', metadata, targetClass.constructor);
      return;
    }

    // NOTE: It is not possible to access other class properties for decorator methods
    // so don't try to access `this.<property>` in any decorator method body
    const originalMethod = descriptor.value as InteractionFunction;
    interactionsMap.set(customId, originalMethod);
  };
}
