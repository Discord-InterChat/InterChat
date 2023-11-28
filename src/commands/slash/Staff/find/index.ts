import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../../BaseCommand.js';

export default class Find extends BaseCommand {
  staffOnly = true;
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
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
    if (subcommand) return await subcommand.execute(interaction);
  }
  async autocomplete(interaction: AutocompleteInteraction) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case 'server': {
        const guilds = interaction.client.guilds.cache;
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices: { name: string; id: string }[] = [];

        guilds.map((guild) => choices.push({ name: guild.name, id: guild.id }));
        const filtered = choices
          .filter(
            (choice) =>
              choice.name.toLowerCase().includes(focusedValue) ||
              choice.id.toLowerCase().includes(focusedValue),
          )
          .slice(0, 25)
          .map((choice) => ({ name: choice.name, value: choice.id }));

        interaction.respond(filtered);
        break;
      }

      case 'user': {
        const users = interaction.client.users.cache;
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices: { username: string; id: string }[] = [];

        users.map((user) => choices.push({ username: user.username, id: user.id }));
        const filtered = choices
          .filter(
            (choice) =>
              choice.username.toLowerCase().includes(focusedValue) ||
              choice.id.toLowerCase().includes(focusedValue),
          )
          .slice(0, 25)
          .map((choice) => ({ name: choice.username, value: choice.id }));

        interaction.respond(filtered);
        break;
      }
      default:
        break;
    }
  }
}