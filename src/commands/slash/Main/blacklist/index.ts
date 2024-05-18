import {
  ApplicationCommandOptionChoiceData,
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { escapeRegexChars, handleError } from '../../../../utils/Utils.js';
import BaseCommand from '../../../../core/BaseCommand.js';
import db from '../../../../utils/Db.js';

export default class BlacklistCommand extends BaseCommand {
  // TODO: Put this in readme
  static readonly subcommands = new Collection<string, BaseCommand>();

  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    name: 'blacklist',
    description: 'Blacklist a user or server from a hub.',
    options: [
      {
        type: ApplicationCommandOptionType.SubcommandGroup,
        name: 'add',
        description: 'Add blacklist',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'user',
            description: 'Blacklist a user from using your hub.',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'hub',
                description: 'The name of the hub to blacklist the user from.',
                required: true,
                autocomplete: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'user',
                description:
                  'The user ID to blacklist. User tag also works if they are already cached.',
                required: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'reason',
                description: 'The reason for blacklisting the user.',
                required: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'duration',
                description: 'The duration of the blacklist. Eg. 1d, 1w, 1m, 1y',
                required: false,
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'server',
            description: 'Blacklist a server from using your hub.',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'hub',
                description: 'The name of the hub to blacklist the server from.',
                required: true,
                autocomplete: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'server',
                description: 'The server ID to blacklist.',
                required: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'reason',
                description: 'The reason for blacklisting the server.',
                required: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'duration',
                description: 'The duration of the blacklist. Eg. 1d, 1w, 1m, 1y',
                required: false,
              },
            ],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.SubcommandGroup,
        name: 'remove',
        description: 'Remove a blacklist from your hub.',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'user',
            description: 'Remove a user from the blacklist.',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'hub',
                description: 'The name of the hub to blacklist the user from.',
                required: true,
                autocomplete: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'user',
                description: 'The user to remove from the blacklist. User tag also works.',
                required: true,
                autocomplete: true,
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'server',
            description: 'Remove a server from the blacklist.',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'hub',
                description: 'The name of the hub to blacklist the user from.',
                required: true,
                autocomplete: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'server',
                description: 'The server to remove from the blacklist.',
                required: true,
                autocomplete: true,
              },
            ],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'list',
        description: 'List all blacklists for your hub.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'hub',
            description: 'The name of the hub to blacklist the user from.',
            required: true,
            autocomplete: true,
          },
          {
            type: ApplicationCommandOptionType.String,
            name: 'type',
            description: 'The type of blacklist to list.',
            required: true,
            choices: [
              { name: 'User', value: 'user' },
              { name: 'Server', value: 'server' },
            ],
          },
        ],
      },
    ],
  };

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subCommandName = interaction.options.getSubcommand();
    const subcommand = BlacklistCommand.subcommands.get(subCommandName);

    await subcommand?.execute(interaction).catch((e) => handleError(e, interaction));
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const action = interaction.options.getSubcommand() as 'user' | 'server';
    const hubOpt = interaction.options.get('hub');

    if (typeof hubOpt?.value !== 'string') return;

    let choices: ApplicationCommandOptionChoiceData<string>[] = [];

    if (hubOpt.focused) {
      choices = await this.findHubsByName(hubOpt.value, interaction.user.id);
    }
    else {
      const hub = await db.hubs.findFirst({
        where: {
          name: hubOpt.value,
          OR: [
            { ownerId: interaction.user.id },
            { moderators: { some: { userId: interaction.user.id } } },
          ],
        },
      });

      if (!hub) {
        await interaction.respond([]);
        return;
      }

      switch (action) {
        case 'user': {
          const userOpt = interaction.options.get('user');
          if (!userOpt?.focused || typeof userOpt.value !== 'string') return;
          choices = await this.searchBlacklistedUsers(hub.id, userOpt.value);
          break;
        }

        case 'server': {
          const serverOpt = interaction.options.get('server', true);
          if (!serverOpt.focused || typeof serverOpt.value !== 'string') return;
          choices = await this.searchBlacklistedServers(hub.id, serverOpt.value);
          break;
        }
        default:
          break;
      }
    }

    await interaction.respond(choices);
  }

  private async searchBlacklistedServers(hubId: string, nameOrId: string) {
    const allServers = await db.blacklistedServers.findMany({
      where: {
        hubs: { some: { hubId } },
        OR: [
          { serverName: { mode: 'insensitive', contains: nameOrId } },
          { serverId: { mode: 'insensitive', contains: nameOrId } },
        ],
      },
      take: 25,
    });
    return allServers.map(({ serverName, serverId }) => ({ name: serverName, value: serverId }));
  }

  private async searchBlacklistedUsers(hubId: string, nameOrId: string) {
    const filteredUsers = await db.userData.findMany({
      where: {
        blacklistedFrom: { some: { hubId } },
        OR: [
          { username: { mode: 'insensitive', contains: nameOrId } },
          { userId: { mode: 'insensitive', contains: nameOrId } },
        ],
      },
      take: 25,
    });

    return filteredUsers.map((user) => ({
      name: user.username ?? `Unknown User - ${user.userId}`,
      value: user.userId,
    }));
  }

  private async findHubsByName(name: string, ownerId: string) {
    const hub = await db.hubs.findMany({
      where: {
        name: { mode: 'insensitive', contains: escapeRegexChars(name) },
        OR: [{ ownerId }, { moderators: { some: { userId: ownerId } } }],
      },
      take: 25,
    });

    return hub.map(({ name: hubName }) => ({ name: hubName, value: hubName }));
  }
}
