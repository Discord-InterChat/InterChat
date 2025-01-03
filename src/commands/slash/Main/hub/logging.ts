import HubLogManager, { LogConfigTypes, RoleIdLogConfigs } from '#main/managers/HubLogManager.js';
import HubManager from '#main/managers/HubManager.js';
import { HubService } from '#main/services/HubService.js';
import { isGuildTextBasedChannel } from '#main/utils/ChannelUtls.js';
import db from '#utils/Db.js';
import {
  Channel,
  ChatInputCommandInteraction,
  GuildMember,
  GuildTextBasedChannel,
  Role,
} from 'discord.js';
import HubCommand from './index.js';
import Logger from '#main/utils/Logger.js';

interface SetLogOptions {
  hub: HubManager;
  logType: LogConfigTypes | RoleIdLogConfigs;
  targetId: string | null;
  member: GuildMember;
}

type LogTarget = GuildTextBasedChannel | Role | null;
type SetLogType = 'channel' | 'role';

export default class LoggingCommand extends HubCommand {
  private commandHandlers = {
    view: this.handleViewSubcommand,
    set_channel: this.handleSetChannelSubcommand,
    set_role: this.handleSetRoleSubcommand,
  };

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const hub = await this.getHubForUser(interaction);
    if (!hub) return;

    const subcommand = interaction.options.getSubcommand() as keyof typeof this.commandHandlers;
    const handler = this.commandHandlers[subcommand];

    if (handler) {
      await handler.call(this, interaction, hub);
    }
    else {
      Logger.error(`Unknown subcommand: ${subcommand}`);
    }
  }

  private async getHubForUser(
    interaction: ChatInputCommandInteraction,
  ): Promise<HubManager | null> {
    const hubService = new HubService(db);
    const userId = interaction.user.id;
    const hubName = interaction.options.getString('hub');
    const ownedHubs = await hubService.getOwnedHubs(userId);

    if (ownedHubs.length === 0) {
      await this.replyEmbed(interaction, 'You do not have access to any hubs.', {
        ephemeral: true,
      });
      return null;
    }

    if (hubName) {
      return this.findHubByName(interaction, ownedHubs, hubName);
    }

    return this.getDefaultHub(interaction, ownedHubs);
  }

  private findHubByName(
    interaction: ChatInputCommandInteraction,
    hubs: HubManager[],
    hubName: string,
  ): HubManager | null {
    const hub = hubs.find((h) => h.data.name === hubName);
    if (!hub) {
      this.replyEmbed(interaction, 'Hub not found.', { ephemeral: true });
      return null;
    }
    return hub;
  }

  private getDefaultHub(
    interaction: ChatInputCommandInteraction,
    hubs: HubManager[],
  ): HubManager | null {
    if (hubs.length === 1) {
      return hubs[0];
    }

    this.replyEmbed(interaction, 'You must provide a hub in the `hub` option of the command.', {
      ephemeral: true,
    });
    return null;
  }

  private async handleViewSubcommand(interaction: ChatInputCommandInteraction, hub: HubManager) {
    const hubLogManager = await HubLogManager.create(hub.id);
    const embed = hubLogManager.getEmbed(interaction.client);
    await interaction.reply({ embeds: [embed] });
  }

  private async handleSetChannelSubcommand(
    interaction: ChatInputCommandInteraction<'cached'>,
    hub: HubManager,
  ) {
    const channel = interaction.options.getChannel('channel') as GuildTextBasedChannel | null;
    const logType = interaction.options.getString('log_type', true) as LogConfigTypes;

    if (!this.isChannelPermissionValid(channel, interaction)) return;

    await this.setLogConfig(
      {
        hub,
        logType,
        targetId: channel?.id || null,
        member: interaction.member,
      },
      'channel',
    );

    await this.sendSetConfirmationMessage(interaction, logType, channel, 'channel');
  }

  private async handleSetRoleSubcommand(
    interaction: ChatInputCommandInteraction<'cached'>,
    hub: HubManager,
  ) {
    const role = interaction.options.getRole('role') as Role | null;
    const logType = interaction.options.getString('log_type', true) as RoleIdLogConfigs;

    await this.setLogConfig(
      {
        hub,
        logType,
        targetId: role?.id || null,
        member: interaction.member,
      },
      'role',
    );

    await this.sendSetConfirmationMessage(interaction, logType, role, 'role');
  }

  private async setLogConfig({ hub, logType, targetId }: SetLogOptions, setType: SetLogType) {
    const logManager = await hub.fetchLogConfig();
    if (!targetId) {
      await this.resetLogConfig(logManager, logType, setType);
      return;
    }

    await this.applyLogConfig(logManager, logType, targetId, setType);
  }

  private async resetLogConfig(
    hubLogManager: HubLogManager,
    logType: LogConfigTypes | RoleIdLogConfigs,
    setType: SetLogType,
  ) {
    if (setType === 'channel') {
      await hubLogManager.resetLog(logType as LogConfigTypes);
    }
    else {
      await hubLogManager.removeRoleId(logType as RoleIdLogConfigs);
    }
  }

  private async applyLogConfig(
    hubLogManager: HubLogManager,
    logType: LogConfigTypes | RoleIdLogConfigs,
    targetId: string,
    setType: SetLogType,
  ) {
    if (setType === 'channel') {
      await hubLogManager.setLogChannel(logType as LogConfigTypes, targetId);
    }
    else {
      if (!hubLogManager.config.appeals?.channelId) {
        throw new Error('Appeals channel must be set before setting role ID');
      }
      await hubLogManager.setRoleId(logType as RoleIdLogConfigs, targetId);
    }
  }

  private isChannelPermissionValid(
    channel: GuildTextBasedChannel | null,
    interaction: ChatInputCommandInteraction<'cached'>,
  ): boolean {
    if (!channel) return true;

    const hasPermissions =
      isGuildTextBasedChannel(channel as Channel) &&
      channel.permissionsFor(interaction.member).has('ManageMessages', true);

    if (!hasPermissions) {
      this.replyEmbed(interaction, 'errors.missingPermissions', {
        t: { emoji: this.getEmoji('x_icon'), permissions: 'Manage Messages' },
      });
      return false;
    }

    return true;
  }

  private async sendSetConfirmationMessage(
    interaction: ChatInputCommandInteraction,
    logType: string,
    target: LogTarget,
    type: SetLogType,
  ) {
    const targetMention = target ? `<${type === 'channel' ? '#' : '@&'}${target.id}>` : '';
    const action = target ? 'set' : 'resetting';
    const message = `Successfully ${action} \`${logType}\` ${type} to ${targetMention}.`;
    await this.replyEmbed(interaction, message, { ephemeral: true });
  }
}
