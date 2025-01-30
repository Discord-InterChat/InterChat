import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { fetchUserLocale } from '#src/utils/Utils.js';
import Constants from '#utils/Constants.js';
import { t } from '#utils/Locale.js';

export default class Invite extends BaseCommand {
  constructor() {
    super({
      name: 'invite',
      description: '👋 Invite me to your server!',
      types: { slash: true, prefix: true },
    });
  }
  async execute(ctx: Context) {
    const locale = await fetchUserLocale(ctx.user.id);
    await ctx.reply({
      content: t('invite', locale, {
        support: Constants.Links.SupportInvite,
        invite: Constants.Links.AppDirectory,
        invite_emoji: ctx.getEmoji('plus_icon'),
        support_emoji: ctx.getEmoji('code_icon'),
      }),
    });
  }
}
