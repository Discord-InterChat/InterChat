import {
  type AutocompleteInteraction,
  Collection,
} from 'discord.js';
import BaseCommand from '#src/core/BaseCommand.js';
import FindServerSubcommand from '#src/commands/Staff/find/server.js';
import FindUserSubcommand from '#src/commands/Staff/find/user.js';

export default class Find extends BaseCommand {
  constructor() {
    super({
      name: 'find',
      description: 'Find a user/server (Staff Only).',
      types: { slash: true, prefix: true },
      subcommands: {
        server: new FindServerSubcommand(),
        user: new FindUserSubcommand(),
      },
    });
  }

  // subcommand classes are added to this map in their respective files
  static readonly subcommands = new Collection<string, BaseCommand>();

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
