import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import BlacklistManager from '#src/managers/BlacklistManager.js';
import { HubService } from '#src/services/HubService.js';
import { logUserUnblacklist } from '#src/utils/hub/logger/ModLogs.js';
import { runHubPermissionChecksAndReply } from '#src/utils/hub/utils.js';
import { fetchUserData } from '#src/utils/Utils.js';
import { ApplicationCommandOptionType } from 'discord.js';

export default class UnblacklistUserSubcommand extends BaseCommand {
  private readonly hubService = new HubService();

  constructor() {
    super({
      name: 'user',
      description: 'Unblacklist a user from your hub.',
      types: { prefix: true, slash: true },
      options: [
        {
          name: 'hub',
          description: 'Hub to unblacklist from',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: 'user',
          description: 'The user to unblacklist',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    });
  }

  async execute(ctx: Context): Promise<void> {
    await ctx.deferReply({ flags: ['Ephemeral'] });

    const hubName = ctx.options.getString('hub', true);
    const userId = ctx.options.getString('user', true);

    const hub = (await this.hubService.findHubsByName(hubName)).at(0);
    if (
      !hub ||
			!(await runHubPermissionChecksAndReply(hub, ctx, { checkIfMod: true }))
    ) return;

    const blacklistManager = new BlacklistManager('user', userId);
    const blacklist = await blacklistManager.fetchBlacklist(hub.id);
    if (!blacklist) {
      await ctx.replyEmbed('errors.userNotBlacklisted', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
        edit: true,
      });
      return;
    }

    await blacklistManager.removeBlacklist(hub.id);
    await logUserUnblacklist(ctx.client, hub, { id: userId, mod: ctx.user });

    await ctx.replyEmbed('blacklist.removed', {
      t: {
        emoji: ctx.getEmoji('tick_icon'),
        name: (await fetchUserData(userId))?.username ?? 'Unknown User',
      },
      edit: true,
    });
  }
}
