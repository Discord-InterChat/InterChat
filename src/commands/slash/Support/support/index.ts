import {
  ApplicationCommandOptionType,
  type CacheType,
  type ChatInputCommandInteraction,
  Collection,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { handleError } from '#utils/Utils.js';

export default class Support extends BaseCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'support',
    description: 'Send reports/suggestions to InterChat staff/developers.',
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'server',
        description: '❓ Get the invite to the support server.',
      },
    ],
  };

  // subcommand classes are added to this map in their respective files
  static readonly subcommands = new Collection<string, BaseCommand>();

  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const subCommandName = interaction.options.getSubcommand();
    const subcommand = Support.subcommands?.get(subCommandName);

    await subcommand?.execute(interaction).catch((e) => handleError(e, { repliable: interaction }));
  }
}
