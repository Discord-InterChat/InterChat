import { hubOption } from '#src/commands/Main/hub/index.js';
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { HubService } from '#src/services/HubService.js';
import { runHubPermissionChecksAndReply } from '#src/utils/hub/utils.js';
import { ApplicationCommandOptionType } from 'discord.js';

export default class HubModeratorRemoveSubcommand extends BaseCommand {
  private readonly hubService = new HubService();
  constructor() {
    super({
      name: 'remove',
      description: '🧹 Remove a user from moderator position in your hub',
      types: { slash: true, prefix: true },
      options: [
        hubOption,
        {
          type: ApplicationCommandOptionType.User,
          name: 'user',
          description: 'The user who should be removed',
          required: true,
        },
      ],

    });
  }
  public async execute(ctx: Context) {
    const hubName = ctx.options.getString('hub', true);
    const hub = hubName
      ? (await this.hubService.findHubsByName(hubName)).at(0)
      : undefined;
    if (
      !hub ||
			!(await runHubPermissionChecksAndReply(hub, ctx, {
			  checkIfManager: true,
			}))
    ) return;

    const user = await ctx.options.getUser('user');
    if (!user || !(await hub.isMod(user.id))) {
      await ctx.replyEmbed('hub.moderator.remove.notModerator', {
        t: {
          user: user?.toString() ?? 'Unknown User',
          emoji: ctx.getEmoji('x_icon'),
        },
        flags: ['Ephemeral'],
      });
      return;
    }

    const mod = await hub.moderators.fetch(user.id);
    const isRestrictedAction =
			mod?.role === 'MANAGER' || user.id === ctx.user.id;

    /* executor needs to be owner to:
     - change position of other managers
     - change their own position
     */
    if (!hub.isOwner(ctx.user.id) && isRestrictedAction) {
      await ctx.replyEmbed('hub.moderator.remove.notOwner', {
        t: {
          emoji: ctx.getEmoji('x_icon'),
        },
        flags: ['Ephemeral'],
      });
      return;
    }

    await hub.moderators.remove(user.id);

    await ctx.replyEmbed('hub.moderator.remove.success', {
      t: {
        user: user.toString(),
        emoji: ctx.getEmoji('tick_icon'),
      },
    });
  }
}
