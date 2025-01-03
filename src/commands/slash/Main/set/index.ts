import {
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  ApplicationCommandOptionType,
  Collection,
  ChatInputCommandInteraction,
} from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { handleError } from '#main/utils/Utils.js';
import { supportedLocales } from '#main/utils/Locale.js';

const currSupportedLangs = ['en', 'hi', 'es'] as const;

export default class Set extends BaseCommand {
  static readonly subcommands = new Collection<string, BaseCommand>();

  data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'set',
    description: 'Set your preferences',
    options: [
      {
        name: 'language',
        description: '🈂️ Set the language in which I should respond to you',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'lang',
            description: 'The language to set',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: currSupportedLangs.map((l) => ({ name: supportedLocales[l].name, value: l })),
          },
        ],
      },
      {
        name: 'reply_mentions',
        description: '🔔 Get pinged when someone replies to your messages.',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            type: ApplicationCommandOptionType.Boolean,
            name: 'enable',
            description: 'Enable this setting',
            required: true,
          },
        ],
      },
    ],
  };

  override async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = Set.subcommands?.get(interaction.options.getSubcommand());
    return await subcommand?.execute(interaction).catch((e) => handleError(e, interaction));
  }
}
