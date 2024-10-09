import { emojis } from '#main/config/Constants.js';
import { supportedLocaleCodes, t } from '#utils/Locale.js';
import { Hub } from '@prisma/client';
import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
  type Snowflake,
  type APIApplicationCommandBasicOption,
  ApplicationCommandOptionChoiceData,
  ApplicationCommandOptionType,
  Collection,
  EmbedBuilder,
  time,
} from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import db from '#utils/Db.js';
import { checkIfStaff, escapeRegexChars, getReplyMethod, handleError } from '#utils/Utils.js';

export default class BlacklistCommand extends BaseCommand {
  // TODO: Put this in readme
  static readonly subcommands = new Collection<string, BaseCommand>();
  private readonly hubOpt: APIApplicationCommandBasicOption = {
    type: ApplicationCommandOptionType.String,
    name: 'hub',
    description: 'The name of the hub to blacklist/unblacklist the target from.',
    required: false,
    autocomplete: true,
  };

  private readonly optionalOpts: APIApplicationCommandBasicOption[] = [
    { ...this.hubOpt },
    {
      type: ApplicationCommandOptionType.String,
      name: 'duration',
      description: 'The duration of the blacklist. Eg. 1d, 1w, 1m, 1y',
      required: false,
    },
  ];

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
                type: ApplicationCommandOptionType.User,
                name: 'user',
                description: 'The user ID to blacklist.',
                required: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'reason',
                description: 'The reason for blacklisting the user.',
                required: true,
              },
              ...this.optionalOpts,
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'server',
            description: 'Blacklist a server from using your hub.',
            options: [
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
              ...this.optionalOpts,
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
              { ...this.hubOpt, required: true },
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
              { ...this.hubOpt, required: true },
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

    let choices: ApplicationCommandOptionChoiceData<string>[] = [];

    if (hubOpt?.focused && typeof hubOpt.value === 'string') {
      choices = (await this.findHubsByName(hubOpt?.value, interaction.user.id))?.map(
        ({ name }) => ({
          name,
          value: name,
        }),
      );
    }
    else {
      const hub =
        typeof hubOpt?.value === 'string'
          ? await this.findHubsByName(hubOpt.value, interaction.user.id, 1)
          : await this.getHub({ name: null, userId: interaction.user.id });

      if (!hub || hub === 'exceeds max length') {
        await interaction.respond([
          {
            name: 'Please specify the "hub" option first.',
            value: ' ',
          },
        ]);
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

  protected async getHub({ name, userId }: { name: string | null; userId: Snowflake }) {
    const allHubs = await db.hub.findMany({
      where: {
        name: name ?? undefined,
        OR: [{ ownerId: userId }, { moderators: { some: { userId } } }],
      },
    });

    if (allHubs.length > 1) return 'exceeds max length';

    // assign first value of the hub query
    return allHubs[0];
  }

  protected async sendSuccessResponse(
    interaction: ChatInputCommandInteraction,
    desc: string,
    opts: { reason: string; expires: Date | null },
  ) {
    const successEmbed = new EmbedBuilder()
      .setDescription(desc)
      .setColor('Green')
      .addFields(
        { name: 'Reason', value: opts.reason, inline: true },
        {
          name: 'Expires',
          value: opts.expires
            ? `${time(Math.round(opts.expires.getTime() / 1000), 'R')}`
            : 'Never.',
          inline: true,
        },
      );

    const method = getReplyMethod(interaction);
    await interaction[method]({ embeds: [successEmbed] });
  }

  protected isValidHub(
    interaction: ChatInputCommandInteraction,
    hub: Hub | string | null,
    locale: supportedLocaleCodes = 'en',
  ): hub is Hub {
    const hiddenOpt = { ephemeral: true };
    if (!hub) {
      this.replyEmbed(interaction, t('hub.notFound_mod', locale), hiddenOpt);
      return false;
    }
    else if (hub === 'exceeds max length') {
      this.replyEmbed(
        interaction,
        `${emojis.no} Specify the \`hub\` option of the slash command as you own/moderate more than one hub.`,
        hiddenOpt,
      );
      return false;
    }

    return true;
  }

  protected isStaffOrHubMod(userId: string, hub: Hub | null): hub is Hub {
    const isHubMod =
      hub?.ownerId === userId || hub?.moderators.find((mod) => mod.userId === userId);
    const isStaff = checkIfStaff(userId);

    return Boolean(!hub?.private ? isHubMod || isStaff : isHubMod);
  }

  private async searchBlacklistedServers(hubId: string, nameOrId: string) {
    const allServers = await db.serverInfraction.findMany({
      where: {
        hubId,
        status: 'ACTIVE',
        type: 'BLACKLIST',
        OR: [
          { serverName: { mode: 'insensitive', contains: nameOrId } },
          { id: { mode: 'insensitive', contains: nameOrId } },
        ],
      },
      take: 25,
    });
    return allServers.map(({ serverName, serverId }) => ({ name: serverName, value: serverId }));
  }

  private async searchBlacklistedUsers(hubId: string, nameOrId: string) {
    const filteredUsers = await db.userInfraction.findMany({
      where: {
        hubId,
        status: 'ACTIVE',
        type: 'BLACKLIST',
        OR: [
          { userData: { username: { mode: 'insensitive', contains: nameOrId } } },
          { id: { mode: 'insensitive', contains: nameOrId } },
        ],
      },
      include: { userData: { select: { username: true } } },
      take: 25,
    });

    return filteredUsers.map((user) => ({
      name: `${user.userData.username ?? 'Unknown User'} - ${user.userId}`,
      value: user.userId,
    }));
  }

  private async findHubsByName(name: string, ownerId: string, limit?: number): Promise<Hub[]>;
  private async findHubsByName(name: string, ownerId: string, limit: 1): Promise<Hub>;
  private async findHubsByName(name: string, ownerId: string, limit?: number) {
    const hubs = await db.hub.findMany({
      where: { name: { mode: 'insensitive', contains: escapeRegexChars(name) } },
      take: limit ?? 25,
    });

    if (limit === 1 && hubs.length > 0) return hubs[0];
    return hubs.filter((hub) => this.isStaffOrHubMod(ownerId, hub));
  }
}
