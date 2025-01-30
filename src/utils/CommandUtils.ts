import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import InteractionContext from '#src/core/CommandContext/InteractionContext.js';
import PrefixContext from '#src/core/CommandContext/PrefixContext.js';
import type { InteractionFunction } from '#src/decorators/RegisterInteractionHandler.js';
import { InteractionLoader } from '#src/modules/Loaders/InteractionLoader.js';
import { handleError } from '#src/utils/Utils.js';
import {
  type ApplicationCommand,
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Collection,
  type ContextMenuCommandInteraction,
  type GuildResolvable,
  Message,
} from 'discord.js';

export type CmdInteraction =
	| ChatInputCommandInteraction
	| ContextMenuCommandInteraction;

export const loadInteractions = async (
  map: Collection<string, InteractionFunction>,
) => {
  const loader = new InteractionLoader(map);
  await loader.load();
};

export const fetchCommands = async (client: Client) =>
  await client.application?.commands.fetch();

export const findCommand = (
  name: string,
  commands:
		| Collection<
		  string,
		  ApplicationCommand<{
		    guild: GuildResolvable;
		  }>
		>
		| undefined,
) => commands?.find((command) => command.name === name);

export const findSubcommand = (
  cmdName: string,
  subName: string,
  commands: Collection<
    string,
    ApplicationCommand<{
      guild: GuildResolvable;
    }>
  >,
) => {
  const command = commands.find(({ name }) => name === cmdName);
  return command?.options.find(
    ({ type, name }) =>
      type === ApplicationCommandOptionType.Subcommand && name === subName,
  );
};

export function resolveCommand(
  commands: Collection<string, BaseCommand>,
  interactionOrMessage:
		| ChatInputCommandInteraction
		| AutocompleteInteraction
		| ContextMenuCommandInteraction
		| Message,
): { command: BaseCommand | null; prefixArgs: string[] } {
  let commandName = '';
  let prefixArgs: string[] = [];

  if (interactionOrMessage instanceof Message) {
    prefixArgs = interactionOrMessage.content
      .slice('c!'.length)
      .trim()
      .split(/ +/);
    const name = prefixArgs.shift()?.toLowerCase();
    if (!name) return { command: null, prefixArgs };

    // if an arg is surrounded by quotes, join the args together (removes the quotes)
    prefixArgs.forEach((arg, index) => {
      if (arg.startsWith('"')) {
        const nextQuoteIndex = prefixArgs.findIndex(
          (_arg, i) => i > index && _arg.endsWith('"'),
        );
        if (nextQuoteIndex !== -1) {
          const joinedArgs = prefixArgs
            .slice(index, nextQuoteIndex + 1)
            .join(' ')
            .slice(1, -1);
          prefixArgs.splice(index, nextQuoteIndex - index + 1, joinedArgs);
        }
      }
    });

    commandName = name;
  }
  else if (interactionOrMessage.isContextMenuCommand()) {
    const command = commands.find(
      (cmd) => cmd.types.contextMenu?.name === interactionOrMessage.commandName,
    );
    if (!command) return { command: null, prefixArgs };
    return { command, prefixArgs };
  }
  else {
    commandName = interactionOrMessage.commandName;
  }

  let command = commands.get(commandName);
  if (!command) return { command: null, prefixArgs };

  if (command.subcommands) {
    /** Slash command visualization: `/<command>` ***`<subcommand2>`*** `<subcommand3>` */
    const secondSubcommandName =
			interactionOrMessage instanceof Message
			  ? prefixArgs.shift()?.toLowerCase()
			  : (interactionOrMessage.options.getSubcommandGroup() ??
					interactionOrMessage.options.getSubcommand());

    if (!secondSubcommandName) return { command: null, prefixArgs };

    const subcommand = command.subcommands[secondSubcommandName];
    if (subcommand instanceof BaseCommand) {
      command = subcommand;
    }
    else if (typeof subcommand === 'object') {
      /** Slash command visualization: `/<command>` `<subcommand2>` ***`<subcommand3>`*** */
      const thirdSubcommandName =
				interactionOrMessage instanceof Message
				  ? prefixArgs.shift()?.toLowerCase()
				  : (
				    interactionOrMessage as ChatInputCommandInteraction
				  ).options.getSubcommand();

      if (!thirdSubcommandName) return { command: null, prefixArgs };

      command = subcommand[thirdSubcommandName];
    }
  }

  return { command, prefixArgs };
}

async function validatePrefixCommand(
  message: Message,
  command: BaseCommand,
  prefixArgs: string[],
) {
  const requiredArgs = command.options.filter((opt) => opt.required);
  // check if any required arguments are missing
  if (command.options.length > 0 && prefixArgs?.length < requiredArgs.length) {
    await message.reply(
      `Invalid usage! The command \`${command.name}\` has the following arguments: ${command.options
        .map((opt) => `\`${opt.name}\``)
        .join(', ')}. Use \`c!help ${command.name}\` for more information.`,
    );
    return false;
  }

  return true;
}

export async function executeCommand(
  interactionOrMessage:
		| Message
		| ChatInputCommandInteraction
		| ContextMenuCommandInteraction,
  command: BaseCommand | undefined,
  prefixArgs: string[] = [],
) {
  if (!command) return;

  let ctx: Context;
  if (interactionOrMessage instanceof Message) {
    if (
      !(await validatePrefixCommand(interactionOrMessage, command, prefixArgs))
    ) return;
    ctx = new PrefixContext(interactionOrMessage, command, prefixArgs);
  }
  else {
    ctx = new InteractionContext(interactionOrMessage, command);
  }

  try {
    if (command.execute) await command.execute(ctx);
  }
  catch (e) {
    handleError(e, { repliable: interactionOrMessage });
  }
}
