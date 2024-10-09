import db from '#utils/Db.js';
import BaseCommand from '#main/core/BaseCommand.js';
import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Collection,
  PermissionFlagsBits,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { escapeRegexChars, handleError } from '#utils/Utils.js';

export default class Connection extends BaseCommand {
  // subcommand classes are added to this map in their respective files
  static readonly subcommands = new Collection<string, BaseCommand>();

  readonly data: RESTPostAPIApplicationCommandsJSONBody = {
    name: 'connection',
    description: 'Pause, unpause or customize your connections to other hubs for this server.',
    default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'customize',
        description: 'Set embed colors, profanity filter, compact mode and more!',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'channel',
            description: 'Choose a connection to manage.',
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'unpause',
        description: 'Unpause the connection to a joined hub.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'channel',
            description: 'The name of the channel to unpause connection',
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'pause',
        description: 'Temporarily stop messages from coming into any channel connected to a hub.',
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: 'channel',
            description: 'The name of the channel to pause connection',
            required: true,
            autocomplete: true,
          },
        ],
      },
    ],
  };
  override async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = Connection.subcommands?.get(interaction.options.getSubcommand());

    await subcommand?.execute(interaction).catch((e: Error) => handleError(e, interaction));
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = escapeRegexChars(interaction.options.getFocused());

    const isInDb = await db.connectedList.findMany({
      where: {
        serverId: interaction.guild?.id,
        OR: [
          { channelId: { contains: focusedValue } },
          { hub: { name: { contains: focusedValue } } },
        ],
      },
      select: { channelId: true, hub: true },
      take: 25,
    });

    const filtered = isInDb?.map(async ({ channelId, hub }) => {
      const channel = await interaction.guild?.channels.fetch(channelId).catch(() => null);
      return { name: `${hub?.name} | #${channel?.name || channelId}`, value: channelId };
    });

    await interaction.respond(await Promise.all(filtered));
  }
}
