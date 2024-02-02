import {
  RESTPostAPIApplicationCommandsJSONBody,
  ApplicationCommandOptionType,
  Collection,
  ChatInputCommandInteraction,
} from 'discord.js';
import BaseCommand from '../../../BaseCommand.js';
import { handleError } from '../../../../utils/Utils.js';
import { supportedLocales } from '../../../../utils/Locale.js';

const nonMtlLangs = ['en', 'hi', 'es'];

export default class Set extends BaseCommand {
  static readonly subcommands = new Collection<string, BaseCommand>();

  data: RESTPostAPIApplicationCommandsJSONBody = {
    name: 'set',
    description: 'Set your preferences',
    options: [
      {
        name: 'language',
        description: 'Set the language in which I should respond to you',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'lang',
            description: 'The language to set',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: Object.entries(supportedLocales).map(([key, { name, emoji }]) => {
              const mtl = nonMtlLangs.includes(key) ? '' : ' (MTL)';
              return {
                name: `${emoji} ${name} ${mtl}`,
                value: key,
              };
            }),
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
