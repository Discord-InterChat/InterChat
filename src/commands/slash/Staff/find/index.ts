import {
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  Collection,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { handleError } from '#utils/Utils.js';

export default class Find extends BaseCommand {
  staffOnly = true;
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'find',
    description: 'Find a user/server (Staff Only).',
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'user',
        description: 'Get information on a user on discord.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'user',
            description: 'The username (if they\'ve used the bot within 24h) or user ID',
            required: true,
            autocomplete: true,
          },
          {
            type: ApplicationCommandOptionType.Boolean,
            name: 'hidden',
            description: 'The response will be hidden for others. (Default: True)',
          },
        ],
      },

      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'server',
        description: 'Get information on a server that InterChat has access to.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'server',
            description: 'The server name or ID.',
            required: true,
            autocomplete: true,
          },
          {
            type: ApplicationCommandOptionType.Boolean,
            name: 'hidden',
            description: 'The response will be hidden for others. (Default: True)',
          },
        ],
      },
    ],
  };

  // subcommand classes are added to this map in their respective files
  static readonly subcommands = new Collection<string, BaseCommand>();

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = Find.subcommands?.get(interaction.options.getSubcommand());

    return await subcommand
      ?.execute(interaction)
      .catch((e: Error) => handleError(e, { repliable: interaction }));
  }
  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case 'server': {
        const guilds = interaction.client.guilds.cache;
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = guilds.map((guild) => ({
          name: guild.name,
          value: guild.id,
        }));

        const filtered = choices
          .filter(
            (choice) =>
              choice.name.toLowerCase().includes(focusedValue) ||
              choice.value.toLowerCase().includes(focusedValue),
          )
          .slice(0, 25);

        await interaction.respond(filtered);
        break;
      }

      case 'user': {
        const users = interaction.client.users.cache;
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const filtered = users
          .filter(
            (choice) =>
              choice.username.toLowerCase().includes(focusedValue) ||
              choice.id.toLowerCase().includes(focusedValue),
          )
          .map((user) => ({ name: user.username, value: user.id }))
          .slice(0, 25);

        await interaction.respond(filtered);
        break;
      }
      default:
        break;
    }
  }
}
