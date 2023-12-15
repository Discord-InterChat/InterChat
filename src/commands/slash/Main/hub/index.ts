import {
  APIApplicationCommandBasicOption,
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  Collection,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../../BaseCommand.js';
import db from '../../../../utils/Db.js';
import { replyWithError } from '../../../../utils/Utils.js';
import Logger from '../../../../utils/Logger.js';
import { captureException } from '@sentry/node';

const hubOption: APIApplicationCommandBasicOption = {
  type: ApplicationCommandOptionType.String,
  name: 'hub',
  description: 'Choose a hub.',
  required: true,
  autocomplete: true,
};

export default class Hub extends BaseCommand {
  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    name: 'hub',
    description: 'Manage your hubs.',
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'browse',
        description: '🔍 Browse public hubs and join them!',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'hub',
            description: 'Search for a hub.',
            required: false,
            autocomplete: true,
          },
          {
            type: ApplicationCommandOptionType.String,
            name: 'sort',
            description: 'Sort the results.',
            required: false,
            choices: [
              {
                name: 'Most Active',
                value: 'active',
              },
              {
                name: 'Most Popular',
                value: 'popular',
              },
              {
                name: 'Most Servers',
                value: 'servers',
              },
              {
                name: 'Recently Created',
                value: 'recent',
              },
            ],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'manage',
        description: '📝 Edit a hub you own.',
        options: [hubOption],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'settings',
        description: '⚙️ Edit your hub settings',
        options: [hubOption],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'join',
        description: '🔗 Join a public/private hub from this server.',
        options: [
          {
            type: ApplicationCommandOptionType.Channel,
            name: 'channel',
            description: 'The channel you want to use connect to a hub.',
            required: true,
            channel_types: [
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
            ],
          },
          { ...hubOption, required: false },
          {
            type: ApplicationCommandOptionType.String,
            name: 'invite',
            description: 'The invite code of the private hub you want to join.',
            required: false,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'leave',
        description: '👋 Leave a hub from this server.',
        options: [hubOption],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'create',
        description: '✨ Create a new hub.',
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'delete',
        description: '🗑️ Delete a hub you own.',
        options: [hubOption],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'servers',
        description: '📜 List all servers in your hub.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'hub',
            description: 'Choose a hub.',
            required: true,
            autocomplete: true,
          },
          {
            type: ApplicationCommandOptionType.String,
            name: 'server',
            description: 'Show details about a specific server that is in the hub by its ID.',
            required: false,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.SubcommandGroup,
        name: 'moderator',
        description: 'Manage hub moderators',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'add',
            description: 'Add a new hub moderator',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'hub',
                description: 'The name of the hub you wish to add moderators to',
                required: true,
                autocomplete: true,
              },
              {
                type: ApplicationCommandOptionType.User,
                name: 'user',
                description: 'User who will become hub moderator',
                required: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'position',
                description: 'Determines what hub permissions they have.',
                required: false,
                choices: [
                  { name: 'Network Moderator', value: 'network_mod' },
                  { name: 'Hub Manager', value: 'manager' },
                ],
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'remove',
            description: 'Remove a user from moderator position in your hub',
            options: [
              { ...hubOption },
              {
                type: ApplicationCommandOptionType.User,
                name: 'user',
                description: 'The user who should be removed',
                required: true,
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'update',
            description: 'Update the position of a hub moderator',
            options: [
              { ...hubOption },
              {
                type: ApplicationCommandOptionType.User,
                name: 'user',
                description: 'The moderator you wish the change',
                required: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'position',
                description: 'The moderator position to update',
                required: true,
                choices: [
                  { name: 'Network Moderator', value: 'network_mod' },
                  { name: 'Hub Manager', value: 'manager' },
                ],
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'list',
            description: 'List all moderators on a hub',
            options: [{ ...hubOption }],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.SubcommandGroup,
        name: 'invite',
        description: 'Manage invites for your private hubs.',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'create',
            description: '🔗 Create a new invite code to your private hub',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'hub',
                description: 'The name of the hub you wish to create this invite for',
                required: true,
                autocomplete: true,
              },
              {
                type: ApplicationCommandOptionType.Number,
                name: 'expiry',
                description: 'The expiry of the invite link. Eg. 10h (10 hours from now)',
                required: false,
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'revoke',
            description: '🚫 Revoke an invite code to your hub',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'code',
                description: 'The invite code',
                required: true,
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'list',
            description: 'List all moderators on a hub',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'hub',
                description: 'The name of the hub',
                required: true,
                autocomplete: true,
              },
            ],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'joined',
        description: '📜 List all hubs you have joined from this server.',
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'logging',
        description: '📁 Enable/disable logging for your hub. (EXPERIMENTAL)', // TODO remove experimental once finished
        options: [
          hubOption,
          {
            type: ApplicationCommandOptionType.String,
            name: 'log_type',
            description: 'The type of logs you want to toggle.',
            choices: [
              { name: 'reports', value: 'reports' },
              { name: 'profanity', value: 'profanity' },
              { name: 'modLogs', value: 'modLogs' },
              { name: 'memberLogs', value: 'memberLogs' },
            ],
            required: true,
          },
          {
            type: ApplicationCommandOptionType.Channel,
            name: 'channel',
            description: 'The channel you want to send this type of logs to.',
            required: true,
            channel_types: [
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
            ],
          },
        ],
      },
    ],
  };

  // subcommand classes are added to this map in their respective files
  static readonly subcommands = new Collection<string, BaseCommand>();

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = Hub.subcommands?.get(
      interaction.options.getSubcommandGroup() || interaction.options.getSubcommand(),
    );

    return await subcommand?.execute(interaction).catch((e) => {
      Logger.error(e);
      captureException(e);

      replyWithError(interaction, e.message);
    });
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<unknown> {
    const managerCmds = ['manage', 'settings', 'invite', 'moderator', 'logging'];
    const modCmds = ['servers'];

    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const focusedValue = interaction.options.getFocused();
    let hubChoices;

    if (subcommand === 'browse' || subcommand === 'join') {
      hubChoices = await db.hubs.findMany({
        where: {
          name: { mode: 'insensitive', contains: focusedValue },
          private: false,
        },
        take: 25,
      });
    }
    else if (modCmds.includes(subcommandGroup || subcommand)) {
      hubChoices = await db.hubs.findMany({
        where: {
          name: { mode: 'insensitive', contains: focusedValue },
          OR: [
            { ownerId: interaction.user.id },
            { moderators: { some: { userId: interaction.user.id } } },
          ],
        },
        take: 25,
      });
    }
    else if (managerCmds.includes(subcommandGroup || subcommand)) {
      hubChoices = await db.hubs.findMany({
        where: {
          name: { mode: 'insensitive', contains: focusedValue },
          OR: [
            { ownerId: interaction.user.id },
            { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
          ],
        },
        take: 25,
      });
    }
    else if (subcommand === 'leave') {
      const networks = await db.connectedList.findMany({
        where: { serverId: interaction.guild?.id },
        select: { channelId: true, hub: true },
        take: 25,
      });

      const filteredNets = networks
        .filter((network) => network.hub?.name.toLowerCase().includes(focusedValue.toLowerCase()))
        .map(async (network) => {
          const channel = await interaction.guild?.channels
            .fetch(network.channelId)
            .catch(() => null);
          return {
            name: `${network.hub?.name} | #${channel?.name ?? network.channelId}`,
            value: network.channelId,
          };
        });

      return await interaction.respond(await Promise.all(filteredNets));
    }
    else if (subcommand === 'delete') {
      hubChoices = await db.hubs.findMany({
        where: {
          ownerId: interaction.user.id,
          name: { mode: 'insensitive', contains: focusedValue },
        },
        take: 25,
      });
    }

    const filtered = hubChoices?.map((hub) => ({ name: hub.name, value: hub.name }));
    filtered ? await interaction.respond(filtered) : null;
  }
}
