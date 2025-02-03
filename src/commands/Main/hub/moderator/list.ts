import HubCommand, { hubOption } from '#src/commands/Main/hub/index.js';
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { HubService } from '#src/services/HubService.js';
import { runHubPermissionChecksAndReply } from '#src/utils/hub/utils.js';
import { t } from '#src/utils/Locale.js';
import { Role } from '@prisma/client';
import { EmbedBuilder, type AutocompleteInteraction } from 'discord.js';

export default class HubModeratorListSubcommand extends BaseCommand {
  private readonly hubService = new HubService();

  constructor() {
    super({
      name: 'list',
      description: '📜 List all moderators on a hub',
      types: { slash: true, prefix: true },
      options: [hubOption],
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

    const locale = await ctx.getLocale();
    const moderators = await hub.moderators.fetchAll();
    await ctx.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Hub Moderators')
          .setDescription(
            moderators.size > 0
              ? moderators
                .map(
                  (mod, index) =>
                    `${index + 1}. <@${mod.userId}> - ${
                      mod.role === Role.MODERATOR
                        ? 'Moderator'
                        : 'Hub Manager'
                    }`,
                )
                .join('\n')
              : t('hub.moderator.noModerators', locale, {
                emoji: ctx.getEmoji('x_icon'),
              }),
          )
          .setColor('Aqua')
          .setTimestamp(),
      ],
      flags: ['Ephemeral'],
    });
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    return await HubCommand.handleManagerCmdAutocomplete(interaction, this.hubService);
  }
}
