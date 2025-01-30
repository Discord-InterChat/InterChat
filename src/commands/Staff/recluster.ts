import BaseCommand from '#src/core/BaseCommand.js';
import { isDev } from '#utils/Utils.js';
import type Context from '#src/core/CommandContext/Context.js';

export default class Respawn extends BaseCommand {
  constructor() {
    super({
      name: 'recluster',
      description: 'Reboot the bot',
      staffOnly: true,
      types: { slash: true, prefix: true },
    });
  }

  async execute(ctx: Context) {
    if (!isDev(ctx.user.id)) {
      await ctx.reply({ content: 'No u', flags: ['Ephemeral'] });
      return;
    }

    await ctx.reply({
      content: `${ctx.getEmoji('tick')} I'll be back!`,
      flags: ['Ephemeral'],
    });
    ctx.client.cluster.send('recluster');
  }
}
