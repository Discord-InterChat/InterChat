import { CustomID } from '#src/utils/CustomID.js';
import Logger from '#src/utils/Logger.js';
import { sendErrorEmbed } from '#src/utils/Utils.js';
import type { EventHint } from '@sentry/bun';
import {
  type ContextMenuCommandInteraction,
  type Interaction,
  InteractionType,
  Message,
} from 'discord.js';
import type {
  CaptureContext,
  ScopeContext,
} from 'node_modules/@sentry/core/build/types/types-hoist/scope.js';

type Repliable = Message | Interaction | ContextMenuCommandInteraction;

export interface ErrorHandlerOptions {
  repliable?: Repliable;
  comment?: string;
}

interface UserInfo {
  id: string;
  username: string;
}

export type ErrorHint =
	| (CaptureContext &
			Partial<{
			  [key in keyof EventHint]: never;
			}>)
	| (EventHint &
			Partial<{
			  [key in keyof ScopeContext]: never;
			}>);

function extractUserInfo(repliable: Repliable): UserInfo {
  if (repliable instanceof Message) {
    return {
      id: repliable.author.id,
      username: repliable.author.username,
    };
  }

  return {
    id: repliable.user.id,
    username: repliable.user.username,
  };
}

function extractCommandInfo(
  interaction: Interaction | ContextMenuCommandInteraction,
): string | undefined {
  if (!interaction.isCommand() && !interaction.isAutocomplete()) {
    return undefined;
  }

  if (interaction.isChatInputCommand()) {
    const subcommand = interaction.options.getSubcommand(false) ?? '';
    const subcommandGroup = interaction.options.getSubcommandGroup(false) ?? '';
    return `${interaction.commandName} ${subcommandGroup} ${subcommand}`.trim();
  }

  return interaction.commandName;
}

export function createErrorHint(
  repliable?: Repliable,
  comment?: string,
): ErrorHint | undefined {
  if (!repliable) {
    return undefined;
  }

  const extra = new Map<string, unknown>();
  const user = extractUserInfo(repliable);

  if (repliable instanceof Message) {
    if (comment) {
      extra.set('comment', comment);
    }
    return { user };
  }

  extra.set('type', InteractionType[repliable.type]);
  extra.set('commandName', extractCommandInfo(repliable));

  if ('customId' in repliable) {
    extra.set('customId', CustomID.parseCustomId(repliable.customId));
  }

  return { user: extractUserInfo(repliable), extra: Object.fromEntries(extra) };
}

export async function sendErrorResponse(
  repliable: Repliable,
  errorCode: string,
  comment?: string,
): Promise<void> {
  if (!('reply' in repliable)) return;

  try {
    await sendErrorEmbed(repliable, errorCode, comment);
  }
  catch (error) {
    Logger.error(error);
  }
}
