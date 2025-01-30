import UserDbService from '#src/services/UserDbService.js';
import type Context from '#src/core/CommandContext/Context.js';
import BaseCommand from '#src/core/BaseCommand.js';
import { ApplicationCommandOptionType } from 'discord.js';

export default class ReplyMention extends BaseCommand {
  constructor() {
    super({
      name: 'reply_mentions',
      description: '🔔 Get pinged when someone replies to your messages.',
      types: { slash: true },
      options: [
        {
          type: ApplicationCommandOptionType.Boolean,
          name: 'enable',
          description: 'Enable this setting',
          required: true,
        },
      ],
    });
  }

  async execute(ctx: Context) {

    const userService = new UserDbService();
    const dbUser = await userService.getUser(ctx.user.id);

    const mentionOnReply = ctx.options.getBoolean('enable') ?? false;
    if (!dbUser) {
      await userService.createUser({
        id: ctx.user.id,
        username: ctx.user.username,
        mentionOnReply,
      });
    }
    else {
      await userService.updateUser(ctx.user.id, { mentionOnReply });
    }

    await ctx.replyEmbed(
      `${ctx.getEmoji('tick')} You will ${mentionOnReply ? 'now' : '**no longer**'} get pinged when someone replies to your messages.`,
      { flags: ['Ephemeral'] },
    );
  }
}
