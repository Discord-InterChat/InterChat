import {
  ApplicationCommandOptionType,
  CacheType,
  ChatInputCommandInteraction,
  Collection,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { handleError } from '#utils/Utils.js';
import BaseCommand from '#main/core/BaseCommand.js';

export default class Support extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    name: 'support',
    description: 'Send reports/suggestions to InterChat staff/developers.',
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'report',
        description:
          'Report a user, server, bug, or anything related to the bot to InterChat staff.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'type',
            description: 'The type of report.',
            required: true,
            choices: [
              { name: 'User', value: 'user' },
              { name: 'Server', value: 'server' },
              { name: 'Bug', value: 'bug' },
              { name: 'Other', value: 'other' },
            ],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'server',
        description: 'Get the invite to the support server.',
      },
    ],
  };

  // subcommand classes are added to this map in their respective files
  static readonly subcommands = new Collection<string, BaseCommand>();

  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const subCommandName = interaction.options.getSubcommand();
    const subcommand = Support.subcommands?.get(subCommandName);

    await subcommand?.execute(interaction).catch((e) => handleError(e, interaction));
  }
}
