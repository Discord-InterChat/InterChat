import { hubOption } from '#src/commands/Main/hub/index.js';
import HubLoggingSetSubcommand from './set.js';
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';

export default class LoggingViewSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'view',
      description: '🔎 View the current log channel & role configuration.',
      types: { slash: true, prefix: true },
      options: [hubOption],
    });
  }
  public async execute(ctx: Context) {
    const hub = await HubLoggingSetSubcommand.getHubForUser(ctx);
    if (!hub) return;

    const hubLogManager = await hub.fetchLogConfig();
    const embed = hubLogManager.getEmbed(ctx.client);
    await ctx.reply({ embeds: [embed] });
  }
}
