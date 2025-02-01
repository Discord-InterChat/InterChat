import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import BlacklistManager from '#src/managers/BlacklistManager.js';
import { HubService } from '#src/services/HubService.js';
import { runHubPermissionChecksAndReply } from '#src/utils/hub/utils.js';
import { sendBlacklistNotif } from '#src/utils/moderation/blacklistUtils.js';
import { ApplicationCommandOptionType } from 'discord.js';
import ms from 'ms';

export default class BlacklistServerSubcommand extends BaseCommand {
  private readonly hubService = new HubService();

  constructor() {
    super({
      name: 'server',
      description: 'Mute/Ban a server from your hub.',
      types: { prefix: true, slash: true },
      options: [
        {
          name: 'serverid',
          description: 'The serverid to blacklist',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: 'reason',
          description: 'Reason for blacklist',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: 'hub',
          description: 'Hub to blacklist from',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: 'duration',
          description: 'Duration for blacklist',
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      ],
    });
  }

  async execute(ctx: Context): Promise<void> {
    await ctx.deferReply({ flags: ['Ephemeral'] });

    const hubName = ctx.options.getString('hub', true);
    const serverId = ctx.options.getString('serverid', true);
    const reason = ctx.options.getString('reason', true);
    const duration = ctx.options.getString('duration');

    const hub = (await this.hubService.findHubsByName(hubName)).at(0);
    if (
      !hub ||
			!runHubPermissionChecksAndReply(hub, ctx, {
			  checkIfMod: true,
			  checkIfStaff: true,
			})
    ) return;

    const server = await ctx.client.fetchGuild(serverId);
    if (!server) {
      await ctx.replyEmbed('errors.userNotFound', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
      });
      return;
    }

    const blacklistManager = new BlacklistManager('server', serverId);
    const alreadyBlacklisted = await blacklistManager.fetchBlacklist(hub.id);
    if (alreadyBlacklisted) {
      await ctx.replyEmbed('blacklist.server.alreadyBlacklisted', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
      });
      return;
    }

    const expiresAt =
			duration && duration?.length > 1
			  ? new Date(ms(duration as ms.StringValue))
			  : null;

    await blacklistManager.addBlacklist({
      hubId: hub.id,
      reason,
      moderatorId: ctx.user.id,
      expiresAt,
      serverName: server.name,
    });

    await blacklistManager.log(hub.id, ctx.client, {
      mod: ctx.user,
      reason,
      expiresAt,
    });

    sendBlacklistNotif('server', ctx.client, {
      hubId: hub.id,
      target: { id: server.id },
      reason,
      expiresAt,
    }).catch(() => null);

    await ctx.replyEmbed('blacklist.success', {
      t: { emoji: ctx.getEmoji('tick_icon'), name: server.name },
    });
  }
}
