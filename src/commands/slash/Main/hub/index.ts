import { Role } from '@prisma/client';
import {
  type APIApplicationCommandBasicOption,
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
  ChannelType,
  type ChatInputCommandInteraction,
  Collection,
  type Guild,
  InteractionContextType,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type Snowflake,
} from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { logsWithRoleId } from '#main/managers/HubLogManager.js';
import HubManager from '#main/managers/HubManager.js';
import { HubSettingsBits } from '#main/modules/BitFields.js';
import { HubService } from '#main/services/HubService.js';
import db from '#utils/Db.js';
import { escapeRegexChars, handleError, toTitleCase } from '#utils/Utils.js';

const hubOption: APIApplicationCommandBasicOption = {
  type: ApplicationCommandOptionType.String,
  name: 'hub',
  description: 'Choose a hub.',
  required: true,
  autocomplete: true,
};

const logTypeOpt = [
  { name: 'Reports', value: 'reports' },
  { name: 'Moderation Logs', value: 'modLogs' },
  { name: 'Profanity', value: 'profanity' },
  { name: 'Join/Leave', value: 'joinLeaves' },
  { name: 'Appeals', value: 'appeals' },
  { name: 'Network Alerts', value: 'networkAlerts' },
];

export default class HubCommand extends BaseCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'hub',
    description: 'Manage your hubs.',
    contexts: [InteractionContextType.Guild],
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'browse',
        description: '🔍 Browse public hubs and join them!',
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'edit',
        description: '📝 Edit a hub you own.',
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
            required: false,
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
            description: '👮 Add a new hub moderator',
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
                  { name: 'Network Moderator', value: Role.MODERATOR },
                  { name: 'Hub Manager', value: Role.MANAGER },
                ] as { name: string; value: Role }[],
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'remove',
            description: '🧹 Remove a user from moderator position in your hub',
            options: [
              hubOption,
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
            name: 'edit',
            description: '📝 Update the position of a hub moderator',
            options: [
              hubOption,
              {
                type: ApplicationCommandOptionType.User,
                name: 'user',
                description: 'The mod you want to edit.',
                required: true,
              },
              {
                type: ApplicationCommandOptionType.String,
                name: 'position',
                description: 'The moderator position to change.',
                required: true,
                choices: [
                  { name: 'Network Moderator', value: Role.MODERATOR },
                  { name: 'Hub Manager', value: Role.MANAGER },
                ],
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'list',
            description: '📜 List all moderators on a hub',
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
                type: ApplicationCommandOptionType.String,
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
            description: '📜 List all moderators on a hub',
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
        name: 'settings',
        description:
          'Manage the toggleable settings of the hub. (eg. Reactions, Spam filter, etc.)',
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [
          {
            name: 'list',
            description: '🔎 List all the settings of the hub.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [{ ...hubOption }],
          },
          {
            name: 'toggle',
            description: '⚡⚙️ Toggle a setting of the hub.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'setting',
                description: 'The setting to toggle.',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: Object.keys(HubSettingsBits).map((s) => ({
                  name: s,
                  value: s,
                })),
              },
              { ...hubOption },
            ],
          },
        ],
      },
      {
        name: 'logging',
        description: 'Edit log channels & roles for this hub.',
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'view',
            description: '🔎 View the current log channel & role configuration.',
            options: [{ ...hubOption }],
          },
          {
            name: 'set_channel',
            description: '💾 Set a channel for a log type.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'log_type',
                description: 'The type of log to set a channel for.',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: logTypeOpt,
              },
              {
                name: 'channel',
                description: 'The channel to set for the log type.',
                type: ApplicationCommandOptionType.Channel,
                required: true,
              },
              { ...hubOption },
            ],
          },
          {
            name: 'set_role',
            description: '🏷️ Set a role for a log type.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
              {
                name: 'log_type',
                description: 'The type of log to set a role for.',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: logsWithRoleId.map((log) => ({
                  name: toTitleCase(log),
                  value: log,
                })),
              },
              {
                name: 'role',
                description: 'The role to set for the log type.',
                type: ApplicationCommandOptionType.Role,
                required: true,
              },
              { ...hubOption },
            ],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.SubcommandGroup,
        name: 'appeal',
        description: '⚖️ Manage appeal settings for your hub.',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'set_cooldown',
            description: '⌛ Set the duration a user must wait before appealing a blacklist again.',
            options: [
              {
                type: ApplicationCommandOptionType.String,
                name: 'cooldown',
                description: 'The duration. Eg. 1h, 1d, 1w, 1mo',
                required: true,
              },
              { ...hubOption },
            ],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'infractions',
        description: '🚩 View infractions for a user or server in a hub.',
        options: [
          hubOption,
          {
            name: 'type',
            description: 'The type of blacklist to view.',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
              { name: 'Server', value: 'server' },
              { name: 'User', value: 'user' },
            ],
          },
          {
            name: 'target',
            description: 'The userId or serverId to view infractions for.',
            type: ApplicationCommandOptionType.String,
            required: false,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.SubcommandGroup,
        name: 'blockwords',
        description: 'Manage blocked words in your hub.',
        options: [
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'create',
            description: '🧱 Add a new block word rule to your hub.',
            options: [hubOption],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'edit',
            description: '📝 Edit an existing blocked word rule in your hub.',
            options: [
              hubOption,
              {
                type: ApplicationCommandOptionType.String,
                name: 'rule',
                description: 'The name of the rule you want to edit.',
                required: true,
                autocomplete: true,
              },
            ],
          },
          {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'list',
            description: '📜 View all blocked word rules for a hub.',
            options: [hubOption],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'announce',
        description: '📢 Send an announcement to a hub you moderate.',
        options: [hubOption],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'visibility',
        description: '👀 Toggle the visibility of a hub (Public/Private).',
        options: [
          hubOption,
          {
            type: ApplicationCommandOptionType.String,
            name: 'visibility',
            description: 'The visibility of the hub.',
            required: true,
            choices: [
              { name: 'Public', value: 'public' },
              { name: 'Private', value: 'private' },
            ],
          },
        ],
      },
    ],
  };

  // subcommand classes are added to this map in their respective files
  static readonly subcommands = new Collection<string, BaseCommand>();

  protected readonly hubService = new HubService();

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = HubCommand.subcommands?.get(
      interaction.options.getSubcommandGroup() ?? interaction.options.getSubcommand(),
    );

    await subcommand
      ?.execute(interaction)
      .catch((e: Error) => handleError(e, { repliable: interaction }));
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const modCmds = ['servers', 'invite', 'announce'];
    const managerCmds = [
      'edit',
      'visibility',
      'settings',
      'moderator',
      'logging',
      'appeal',
      'blockwords',
    ];

    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const focusedValue = escapeRegexChars(interaction.options.getFocused());
    let hubChoices: HubManager[] = [];

    if (subcommand === 'browse' || subcommand === 'join') {
      hubChoices = await this.getPublicHubs(focusedValue);
    }
    else if (subcommandGroup === 'blockwords' && subcommand === 'edit') {
      const choices = await this.getBlockWordRules(interaction);
      await interaction.respond(choices ?? []);
      return;
    }
    else if (modCmds.includes(subcommandGroup || subcommand)) {
      hubChoices = await this.getModeratedHubs(focusedValue, interaction.user.id);
    }
    else if (managerCmds.includes(subcommandGroup || subcommand)) {
      hubChoices = await this.getManagedHubs(focusedValue, interaction.user.id);
    }
    else if (subcommand === 'delete') {
      hubChoices = await this.getOwnedHubs(focusedValue, interaction.user.id);
    }
    else if (subcommand === 'leave') {
      const choices = await this.getLeaveSubcommandChoices(focusedValue, interaction.guild);
      await interaction.respond(choices ?? []);
      return;
    }
    else if (subcommand === 'infractions') {
      const choices = await this.getInfractionSubcommandChoices(interaction);
      await interaction.respond(choices ?? []);
      return;
    }

    const choices = hubChoices.map((hub) => ({
      name: hub.data.name,
      value: hub.data.name,
    }));
    await interaction.respond(choices ?? []);
  }

  private async getBlockWordRules(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    const hubName = interaction.options.getString('hub');

    if (focused.name === 'rule') {
      if (!hubName) return [{ name: 'Please select a hub first.', value: '' }];

      const rules = await db.blockWord.findMany({
        where: { hub: { name: hubName } },
        select: { id: true, name: true },
      });

      return rules.map((rule) => ({ name: rule.name, value: rule.name }));
    }
    return null;
  }

  private async getPublicHubs(focusedValue: string) {
    const hubs = await db.hub.findMany({
      where: {
        name: { mode: 'insensitive', contains: focusedValue },
        private: false,
      },
      take: 25,
    });

    return hubs.map((hub) => new HubManager(hub, { hubService: this.hubService }));
  }

  private async getModeratedHubs(focusedValue: string, modId: Snowflake) {
    const hubs = (await this.hubService.fetchModeratedHubs(modId))
      .filter((hub) => hub.data.name.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25);
    return hubs;
  }

  private async getManagedHubs(focusedValue: string, modId: Snowflake) {
    const hubs = (await this.hubService.fetchModeratedHubs(modId))
      .filter((hub) => hub.data.name.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25);

    return hubs;
  }

  private async getOwnedHubs(focusedValue: string, ownerId: Snowflake) {
    const hubs = await this.hubService.getOwnedHubs(ownerId);
    return hubs.filter((hub) => hub.data.name.toLowerCase().includes(focusedValue.toLowerCase()));
  }

  private async getInfractionSubcommandChoices(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'hub') {
      return (await this.getModeratedHubs(focused.value, interaction.user.id)).map((hub) => ({
        name: hub.data.name,
        value: hub.data.name,
      }));
    }
  }

  private async getLeaveSubcommandChoices(focusedValue: string, guild: Guild | null) {
    if (!guild) return null;

    const networks = await db.connection.findMany({
      where: { serverId: guild?.id },
      select: { channelId: true, hub: true },
      take: 25,
    });

    return Promise.all(
      networks
        .filter((network) => network.hub?.name.toLowerCase().includes(focusedValue.toLowerCase()))
        .map(async (network) => {
          const channel = await guild?.channels.fetch(network.channelId).catch(() => null);
          return {
            name: `${network.hub?.name} | #${channel?.name ?? network.channelId}`,
            value: network.channelId,
          };
        }),
    );
  }
}
