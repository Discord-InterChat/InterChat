import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import db from '#src/utils/Db.js';
import { ApplicationCommandOptionType } from 'discord.js';

export default class InviteRevokeSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'revoke',
      description: '🚫 Revoke an invite code to your hub',
      types: { slash: true, prefix: true },
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'code',
          description: 'The invite code',
          required: true,
        },
      ],
    });
  }
  public async execute(ctx: Context) {
    const code = ctx.options.getString('code', true);

    const inviteInDb = await db.hubInvite.findFirst({
      where: {
        code,
        hub: {
          OR: [
            { ownerId: ctx.user.id },
            {
              moderators: {
                some: { userId: ctx.user.id, role: 'MANAGER' },
              },
            },
          ],
        },
      },
    });

    if (!inviteInDb) {
      await ctx.replyEmbed('hub.invite.revoke.invalidCode', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
      });
      return;
    }

    await db.hubInvite.delete({ where: { code } });
    await ctx.replyEmbed('hub.invite.revoke.success', {
      t: {
        emoji: ctx.getEmoji('tick_icon'),
        inviteCode: code,
      },
      flags: ['Ephemeral'],
    });
  }
}
