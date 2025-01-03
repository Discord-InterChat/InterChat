import BaseCommand from '#main/core/BaseCommand.js';
import HubManager from '#main/managers/HubManager.js';
import { HubService } from '#main/services/HubService.js';
import { isStaffOrHubMod } from '#main/utils/hub/utils.js';

import db from '#utils/Db.js';
import { supportedLocaleCodes, t } from '#utils/Locale.js';
import { getReplyMethod, handleError } from '#utils/Utils.js';
import {
  type APIApplicationCommandBasicOption,
  ApplicationCommandOptionChoiceData,
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  Collection,
  EmbedBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type Snowflake,
  time,
} from 'discord.js';

export default class BlacklistCommand extends BaseCommand {
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

  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
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
            description: '🚫👤 Blacklist a user from using your hub.',
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
            description: '🚫🏠 Blacklist a server from using your hub.',
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
            description: '🧹🚫 Remove a user from the blacklist.',
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
            description: '🧹🚫 Remove a server from the blacklist.',
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
        description: '📝 List all blacklists for your hub.',
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

  protected readonly hubService = new HubService();

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
        ({ data }) => ({
          name: data.name,
          value: data.name,
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
    const allHubs = (await this.hubService.fetchModeratedHubs(userId)).filter((h) =>
      name ? h.data.name === name : true,
    );

    // FIXME: what was I smoking when I wrote this?
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
    hub: HubManager | string | null,
    locale: supportedLocaleCodes = 'en',
  ): hub is HubManager {
    const hiddenOpt = { ephemeral: true };
    if (!hub) {
      this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }), hiddenOpt);
      return false;
    }
    else if (hub === 'exceeds max length') {
      this.replyEmbed(
        interaction,
        `${this.getEmoji('x_icon')} Specify the \`hub\` option of the slash command as you own/moderate more than one hub.`,
        hiddenOpt,
      );
      return false;
    }

    return true;
  }

  private async searchBlacklistedServers(hubId: string, nameOrId: string) {
    const allServers = await db.infraction.findMany({
      where: {
        hubId,
        status: 'ACTIVE',
        type: 'BLACKLIST',
        OR: [
          { serverName: { mode: 'insensitive', contains: nameOrId } },
          { serverId: { mode: 'insensitive', contains: nameOrId } },
        ],
      },
      take: 25,
    });
    return allServers
      .filter((infraction) => Boolean(infraction.userId))
      .map(({ serverName, serverId }) => ({
        name: serverName,
        value: serverId,
      })) as ApplicationCommandOptionChoiceData<string>[];
  }

  private async searchBlacklistedUsers(hubId: string, nameOrId: string) {
    const filteredUsers = await db.infraction.findMany({
      where: {
        hubId,
        status: 'ACTIVE',
        type: 'BLACKLIST',
        OR: [
          { user: { username: { mode: 'insensitive', contains: nameOrId } } },
          { userId: { mode: 'insensitive', contains: nameOrId } },
        ],
      },
      include: { user: { select: { username: true } } },
      take: 25,
    });

    return filteredUsers
      .filter((infraction) => Boolean(infraction.userId))
      .map(({ user, userId }) => ({
        name: `${user?.username ?? 'Unknown User'} - ${userId}`,
        value: userId,
      })) as ApplicationCommandOptionChoiceData<string>[];
  }

  protected async findHubsByName(
    name: string,
    modId: string,
    limit?: number,
  ): Promise<HubManager[]>;
  protected async findHubsByName(name: string, modId: string, limit: 1): Promise<HubManager | null>;
  protected async findHubsByName(name: string, modId: string, limit = 25) {
    const hubs = await this.hubService.findHubsByName(name, { insensitive: true, take: limit });

    if (limit === 1) return hubs.at(0) ?? null;
    return await Promise.all(hubs.filter((h) => isStaffOrHubMod(modId, h)));
  }
}
