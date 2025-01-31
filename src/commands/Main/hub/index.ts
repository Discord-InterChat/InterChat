import AnnounceCommand from '#src/commands/Main/hub/announce.js';
import AppealCooldownCommand from '#src/commands/Main/hub/appeal/set_cooldown.js';
import HubBlockwordsCreateSubcommand from '#src/commands/Main/hub/blockwords/create.js';
import EditBlockWords from '#src/commands/Main/hub/blockwords/edit.js';
import ListBlockWords from '#src/commands/Main/hub/blockwords/list.js';
import BrowseCommand from '#src/commands/Main/hub/browse.js';
import HubCreateSubCommand from '#src/commands/Main/hub/create.js';
import HubDeleteSubcommand from '#src/commands/Main/hub/delete.js';
import HubEditSubcommand from '#src/commands/Main/hub/edit.js';
import HubInfractionsSubcommand from '#src/commands/Main/hub/infractions.js';
import HubInviteCreateSubcommand from '#src/commands/Main/hub/invite/create.js';
import HubInviteListSubcommand from '#src/commands/Main/hub/invite/list.js';
import HubInviteRevokeSubcommand from '#src/commands/Main/hub/invite/revoke.js';
import HubJoinSubcommand from '#src/commands/Main/hub/join.js';
import HubLeaveSubcommand from '#src/commands/Main/hub/leave.js';
import HubLoggingSetSubcommand from '#src/commands/Main/hub/logging/set.js';
import LoggingViewSubcommand from '#src/commands/Main/hub/logging/view.js';
import HubModeratorAddSubcommand from '#src/commands/Main/hub/moderator/add.js';
import HubModeratorEditSubcommand from '#src/commands/Main/hub/moderator/edit.js';
import HubModeratorListSubcommand from '#src/commands/Main/hub/moderator/list.js';
import HubModeratorRemoveSubcommand from '#src/commands/Main/hub/moderator/remove.js';
import HubServersSubcommand from '#src/commands/Main/hub/servers.js';
import HubSettingsListSubcommand from '#src/commands/Main/hub/settings/list.js';
import HubSettingsToggleSubcommand from '#src/commands/Main/hub/settings/toggle.js';
import HubVisibilitySubcommnd from '#src/commands/Main/hub/visibility.js';
import BaseCommand from '#src/core/BaseCommand.js';
import HubManager from '#src/managers/HubManager.js';
import { HubService } from '#src/services/HubService.js';
import db from '#utils/Db.js';
import { escapeRegexChars } from '#utils/Utils.js';
import {
  type APIApplicationCommandBasicOption,
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
  type Guild,
  type Snowflake,
} from 'discord.js';

export const hubOption: APIApplicationCommandBasicOption = {
  type: ApplicationCommandOptionType.String,
  name: 'hub',
  description: 'Choose a hub.',
  required: true,
  autocomplete: true,
};

export default class HubCommand extends BaseCommand {
  constructor() {
    super({
      name: 'hub',
      description: 'Manage your hubs.',
      contexts: { guildOnly: true },
      types: { slash: true, prefix: true },
      subcommands: {
        appeal: { set_cooldown: new AppealCooldownCommand() },
        blockwords: {
          add: new HubBlockwordsCreateSubcommand(),
          edit: new EditBlockWords(),
          list: new ListBlockWords(),
        },
        invite: {
          create: new HubInviteCreateSubcommand(),
          revoke: new HubInviteRevokeSubcommand(),
          list: new HubInviteListSubcommand(),
        },
        logging: {
          set: new HubLoggingSetSubcommand(),
          view: new LoggingViewSubcommand(),
        },
        moderator: {
          add: new HubModeratorAddSubcommand(),
          remove: new HubModeratorRemoveSubcommand(),
          edit: new HubModeratorEditSubcommand(),
          list: new HubModeratorListSubcommand(),
        },
        settings: {
          list: new HubSettingsListSubcommand(),
          toggle: new HubSettingsToggleSubcommand(),
        },
        announce: new AnnounceCommand(),
        browse: new BrowseCommand(),
        create: new HubCreateSubCommand(),
        delete: new HubDeleteSubcommand(),
        edit: new HubEditSubcommand(),
        infractions: new HubInfractionsSubcommand(),
        join: new HubJoinSubcommand(),
        leave: new HubLeaveSubcommand(),
        servers: new HubServersSubcommand(),
        visibility: new HubVisibilitySubcommnd(),
      },
    });
  }

  private readonly hubService = new HubService();

  // TODO: implement autocomplete
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
      hubChoices = await this.getModeratedHubs(
        focusedValue,
        interaction.user.id,
      );
    }
    else if (managerCmds.includes(subcommandGroup || subcommand)) {
      hubChoices = await this.getManagedHubs(focusedValue, interaction.user.id);
    }
    else if (subcommand === 'delete') {
      hubChoices = await this.getOwnedHubs(focusedValue, interaction.user.id);
    }
    else if (subcommand === 'leave') {
      const choices = await this.getLeaveSubcommandChoices(
        focusedValue,
        interaction.guild,
      );
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

    return hubs.map(
      (hub) => new HubManager(hub, { hubService: this.hubService }),
    );
  }

  private async getModeratedHubs(focusedValue: string, modId: Snowflake) {
    const hubs = (await this.hubService.fetchModeratedHubs(modId))
      .filter((hub) =>
        hub.data.name.toLowerCase().includes(focusedValue.toLowerCase()),
      )
      .slice(0, 25);
    return hubs;
  }

  private async getManagedHubs(focusedValue: string, modId: Snowflake) {
    const hubs = (await this.hubService.fetchModeratedHubs(modId))
      .filter((hub) =>
        hub.data.name.toLowerCase().includes(focusedValue.toLowerCase()),
      )
      .slice(0, 25);

    return hubs;
  }

  private async getOwnedHubs(focusedValue: string, ownerId: Snowflake) {
    const hubs = await this.hubService.getOwnedHubs(ownerId);
    return hubs.filter((hub) =>
      hub.data.name.toLowerCase().includes(focusedValue.toLowerCase()),
    );
  }

  private async getInfractionSubcommandChoices(
    interaction: AutocompleteInteraction,
  ) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'hub') {
      return (
        await this.getModeratedHubs(focused.value, interaction.user.id)
      ).map((hub) => ({
        name: hub.data.name,
        value: hub.data.name,
      }));
    }
  }

  private async getLeaveSubcommandChoices(
    focusedValue: string,
    guild: Guild | null,
  ) {
    if (!guild) return null;

    const networks = await db.connection.findMany({
      where: { serverId: guild?.id },
      select: { channelId: true, hub: true },
      take: 25,
    });

    return Promise.all(
      networks
        .filter((network) =>
          network.hub?.name.toLowerCase().includes(focusedValue.toLowerCase()),
        )
        .map(async (network) => {
          const channel = await guild?.channels
            .fetch(network.channelId)
            .catch(() => null);
          return {
            name: `${network.hub?.name} | #${channel?.name ?? network.channelId}`,
            value: network.channelId,
          };
        }),
    );
  }
}
