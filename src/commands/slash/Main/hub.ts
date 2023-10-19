import {
  APIApplicationCommandBasicOption,
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  Collection,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
import db from '../../../utils/Db.js';

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
                value: 'most-active',
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
            channel_types: [ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread],
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
        options: [
          {
            name: 'name',
            description: 'A name for your hub.',
            required: true,
            type: ApplicationCommandOptionType.String,
          },
          {
            name: 'icon',
            description: 'The icon of your hub. Use a valid i.imgur.com link.',
            type: ApplicationCommandOptionType.String,
          },
          {
            name: 'banner',
            description: 'The banner of your hub. Use a valid i.imgur.com link.',
            type: ApplicationCommandOptionType.String,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'delete',
        description: '🗑️ Delete a hub you own.',
        options: [hubOption],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'connections',
        description: '📜 List all connected servers to your hub.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'hub',
            description: 'Choose a hub.',
            required: true,
            autocomplete: true,
          },
        ],
      },
    ],
  };

  // subcommand classes are added to this map in their respective files
  static readonly subcommands = new Collection<string, BaseCommand>;

  async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    const subCommand = interaction.options.getSubcommand();
    const isValid = Hub.subcommands?.get(subCommand);
    if (isValid) return await isValid.execute(interaction);
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<unknown> {
    const modCmds = ['manage', 'settings', 'connections', 'invite', 'moderator'];

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
