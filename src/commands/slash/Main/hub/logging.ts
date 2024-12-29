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

interface SetLogOptions {
  hubId: string;
  logType: LogConfigTypes;
  target: GuildTextBasedChannel | Role | null;
  member: GuildMember;
}

export default class LoggingCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const hub = await this.getHubForUser(interaction);
    if (!hub) return;

    const handlers = {
      view: () => this.handleView(interaction, hub),
      set_channel: () => this.handleSetChannel(interaction, hub.id),
      set_role: () => this.handleSetRole(interaction, hub.id),
    };

    const subcommand = interaction.options.getSubcommand() as keyof typeof handlers;
    await handlers[subcommand]?.();
  }

  private async getHubForUser(
    interaction: ChatInputCommandInteraction,
  ): Promise<HubManager | null> {
    const hubService = new HubService(db);
    const hubName = interaction.options.getString('hub');
    const hubs = await hubService.getOwnedHubs(interaction.user.id);

    if (hubs.length === 0) {
      await this.replyEmbed(interaction, 'You do not have access to any hubs.', {
        ephemeral: true,
      });
      return null;
    }

    if (hubName) {
      const hub = hubs.find((h) => h.data.name === hubName);
      if (!hub) {
        await this.replyEmbed(interaction, 'Hub not found.', { ephemeral: true });
        return null;
      }
      return hub;
    }

    if (hubs.length === 1) return hubs[0];

    await this.replyEmbed(
      interaction,
      'You must provide a hub in the `hub` option of the command.',
      { ephemeral: true },
    );
    return null;
  }

  private async handleView(interaction: ChatInputCommandInteraction, hub: HubManager) {
    const hubLogManager = await HubLogManager.create(hub.id);
    const embed = hubLogManager.getEmbed(interaction.client);
    await interaction.reply({ embeds: [embed] });
  }

  private async handleSetChannel(
    interaction: ChatInputCommandInteraction<'cached'>,
    hubId: string,
  ) {
    const channel = interaction.options.getChannel('channel') as GuildTextBasedChannel | null;
    const logType = interaction.options.getString('log_type', true) as LogConfigTypes;

    if (!this.validateChannelPermissions(channel, interaction)) return;

    await this.handleSetLogConfig({
      hubId,
      logType,
      target: channel,
      member: interaction.member,
      setType: 'channel',
    });

    await this.sendSetConfirmation(interaction, logType, channel, 'channel');
  }

  private async handleSetRole(interaction: ChatInputCommandInteraction<'cached'>, hubId: string) {
    const role = interaction.options.getRole('role');
    const logType = interaction.options.getString('log_type', true) as RoleIdLogConfigs;

    await this.handleSetLogConfig({
      hubId,
      logType,
      target: role,
      member: interaction.member,
      setType: 'role',
    });

    await this.sendSetConfirmation(interaction, logType, role, 'role');
  }

  private async handleSetLogConfig({
    hubId,
    logType,
    target,
    setType,
  }: SetLogOptions & { setType: 'channel' | 'role' }) {
    const hubLogManager = await HubLogManager.create(hubId);

    if (!target?.id) {
      if (setType === 'channel') await hubLogManager.resetLog(logType);
      else await hubLogManager.removeRoleId(logType as RoleIdLogConfigs);
      return;
    }

    if (setType === 'channel') {
      await hubLogManager.setLogChannel(logType, target.id);
    }
    else if (hubLogManager.config.appeals?.channelId) {
      await hubLogManager.setRoleId(logType as RoleIdLogConfigs, target.id);
    }
    else {
      throw new Error('Appeals channel must be set before setting role ID');
    }
  }

  private validateChannelPermissions(
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

  private async sendSetConfirmation(
    interaction: ChatInputCommandInteraction,
    logType: string,
    target: GuildTextBasedChannel | Role | null,
    type: 'channel' | 'role',
  ) {
    const message = target
      ? `Successfully set \`${logType}\` ${type} to <#${target.id}>.`
      : `Successfully reset logging ${type} for type \`${logType}\`.`;

    await this.replyEmbed(interaction, message, { ephemeral: true });
  }
}
