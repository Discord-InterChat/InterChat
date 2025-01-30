import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { handleBan } from '#utils/BanUtils.js';
import {
  ApplicationCommandOptionType,
} from 'discord.js';

export default class Ban extends BaseCommand {
  constructor() {
    super({
      name: 'ban',
      description: '🔨 Ban a user from using the bot. (Dev Only)',
      staffOnly: true,
      types: { slash: true, prefix: true },
      options: [
        {
          type: ApplicationCommandOptionType.User,
          name: 'user',
          description: '🔨 The user to ban.',
          required: true,
        },
        {
          type: ApplicationCommandOptionType.String,
          name: 'reason',
          description: 'Reason for the ban',
          required: true,
        },
      ],
    });
  }

  async execute(ctx: Context) {
    const user = await ctx.options.getUser('user');
    const reason = ctx.options.getString('reason', true);

    if (!user) {
      await ctx.reply('User not found');
      return;
    }

    await handleBan(ctx, user.id, user, reason);
  }
}
