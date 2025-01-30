import { hubOption } from '#src/commands/Main/hub/index.js';
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { HubService } from '#src/services/HubService.js';
import { runHubPermissionChecksAndReply } from '#src/utils/hub/utils.js';

export default class HubSettingsListSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'list',
      description: '🔎 List all the settings of the hub.',
      types: { slash: true, prefix: true },
      options: [{ ...hubOption }],
    });
  }
  private readonly hubService = new HubService();
  async execute(ctx: Context) {
    const hubName = ctx.options.getString('hub');
    const hub = hubName
      ? (await this.hubService.findHubsByName(hubName)).at(0)
      : null;

    if (
      !hub ||
			!(await runHubPermissionChecksAndReply(hub, ctx, {
			  checkIfManager: true,
			}))
    ) return;

    await ctx.reply({
      embeds: [hub.settings.getEmbed(ctx.client)],
    });
  }
}
