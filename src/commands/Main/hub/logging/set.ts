import { hubOption, logTypeChoices } from '#src/commands/Main/hub/index.js';
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
// biome-ignore lint/style/useImportType: <explanation>
import HubLogManager, {
  type LogConfigTypes,
  type RoleIdLogConfigs,
} from '#src/managers/HubLogManager.js';
import type HubManager from '#src/managers/HubManager.js';
import { HubService } from '#src/services/HubService.js';
import { isGuildTextBasedChannel } from '#src/utils/ChannelUtls.js';
import db from '#src/utils/Db.js';
import {
  type GuildTextBasedChannel,
  GuildMember,
  type Channel,
  type Role,
  ApplicationCommandOptionType,
} from 'discord.js';

interface SetLogOptions {
  hub: HubManager;
  logType: LogConfigTypes | RoleIdLogConfigs;
  targetId: string | null;
}

type LogTarget = GuildTextBasedChannel | Role | null;
type SetLogType = 'channel' | 'role';

export default class HubLoggingSetSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'set',
      description: '🔧 Set the log channel & role configuration.',
      types: { slash: true, prefix: true },
      options: [
        hubOption,
        {
          name: 'log_type',
          description: 'The type of log to set.',
          type: ApplicationCommandOptionType.String,
          choices: logTypeChoices,
          required: true,
        },
        {
          name: 'channel',
          description: 'The channel to set for the log type.',
          type: ApplicationCommandOptionType.Channel,
          required: false,
        },
        {
          name: 'role',
          description: 'The role to set for the log type.',
          type: ApplicationCommandOptionType.Role,
          required: false,
        },
      ],
    });
  }
  public async execute(ctx: Context) {
    const channel = await ctx.options.getChannel('channel');
    const role = await ctx.options.getRole('role');
    if (!role && !channel) {
      await ctx.replyEmbed(
        'You must specify a channel or a role mention (if the channel was already configured) or both.',
        { flags: ['Ephemeral'] },
      );
      return;
    }

    const hub = await HubLoggingSetSubcommand.getHubForUser(ctx);
    if (!hub) {
      await ctx.replyEmbed('hub.notFound_mod', { flags: ['Ephemeral'] });
      return;
    }

    const logType = ctx.options.getString('log_type', true);

    if (channel?.isTextBased() && !channel.isDMBased()) {
      if (!(await this.isChannelPermissionValid(channel, ctx))) return;

      await this.setLogConfig(
        {
          hub,
          logType: logType as LogConfigTypes,
          targetId: channel?.id || null,
        },
        'channel',
      );

      await this.sendSetConfirmationMessage(ctx, logType, channel, 'channel');
    }
    if (role) {
      await this.setLogConfig(
        {
          hub,
          logType: logType as RoleIdLogConfigs,
          targetId: role?.id || null,
        },
        'role',
      );

      await this.sendSetConfirmationMessage(ctx, logType, role, 'role');
    }
  }

  static async getHubForUser(ctx: Context): Promise<HubManager | null> {
    const hubService = new HubService(db);
    const userId = ctx.user.id;
    const hubName = ctx.options.getString('hub', true);
    const hubs = await hubService.findHubsByName(hubName, {
      insensitive: true,
      ownerId: userId,
    });

    return hubs[0] ?? null;
  }

  private async setLogConfig(
    { hub, logType, targetId }: SetLogOptions,
    setType: SetLogType,
  ) {
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

  private async isChannelPermissionValid(
    channel: GuildTextBasedChannel | null,
    ctx: Context,
  ): Promise<boolean> {
    if (!channel) return true;
    if (!ctx.inGuild()) return false;

    const member =
			ctx.member instanceof GuildMember
			  ? ctx.member
			  : await ctx.guild?.members.fetch(ctx.user.id);

    const hasPermissions = member
      ? isGuildTextBasedChannel(channel as Channel) &&
				channel.permissionsFor(member).has('ManageMessages', true)
      : false;

    if (!hasPermissions) {
      ctx.replyEmbed('errors.missingPermissions', {
        t: { emoji: ctx.getEmoji('x_icon'), permissions: 'Manage Messages' },
      });
      return false;
    }

    return true;
  }

  private async sendSetConfirmationMessage(
    ctx: Context,
    logType: string,
    target: LogTarget,
    type: SetLogType,
  ) {
    const targetMention = target
      ? `<${type === 'channel' ? '#' : '@&'}${target.id}>`
      : '';
    const action = target ? 'set' : 'resetting';
    const message = `Successfully ${action} \`${logType}\` ${type} to ${targetMention}.`;
    await ctx.replyEmbed(message, { flags: ['Ephemeral'] });
  }
}
