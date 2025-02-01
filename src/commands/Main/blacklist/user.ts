import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import BlacklistManager from '#src/managers/BlacklistManager.js';
import { HubService } from '#src/services/HubService.js';
import { runHubPermissionChecksAndReply } from '#src/utils/hub/utils.js';
import { sendBlacklistNotif } from '#src/utils/moderation/blacklistUtils.js';
import { fetchUserData } from '#src/utils/Utils.js';
import { ApplicationCommandOptionType } from 'discord.js';
import ms from 'ms';

export default class BlacklistUserSubcommand extends BaseCommand {
  private readonly hubService = new HubService();

  constructor() {
    super({
      name: 'user',
      description: 'Mute/Ban a user from your hub.',
      types: { prefix: true, slash: true },
      options: [
        {
          name: 'user',
          description: 'The user to blacklist',
          type: ApplicationCommandOptionType.User,
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
    const user = await ctx.options.getUser('user');
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


    if (!user || !await fetchUserData(user.id)) {
      await ctx.replyEmbed('errors.userNotFound', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
      });
      return;
    }

    if (await hub.isMod(user.id)) {
      await ctx.replyEmbed('blacklist.user.cannotBlacklistMod', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
      });
      return;
    }

    const blacklistManager = new BlacklistManager('user', user.id);
    const alreadyBlacklisted = await blacklistManager.fetchBlacklist(hub.id);
    if (alreadyBlacklisted) {
      await ctx.replyEmbed('blacklist.user.alreadyBlacklisted', {
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
    });

    await blacklistManager.log(hub.id, ctx.client, {
      mod: ctx.user,
      reason,
      expiresAt,
    });

    sendBlacklistNotif('user', ctx.client, {
      hubId: hub.id,
      target: user,
      reason,
      expiresAt,
    }).catch(() => null);

    await ctx.replyEmbed('blacklist.success', {
      t: { emoji: ctx.getEmoji('tick_icon'), name: user.username },
    });
  }
}
