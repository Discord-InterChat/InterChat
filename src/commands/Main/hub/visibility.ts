import type HubManager from '#src/managers/HubManager.js';
import { InfoEmbed } from '#src/utils/EmbedUtils.js';
import { wait } from '#src/utils/Utils.js';

import { stripIndents } from 'common-tags';
import { ApplicationCommandOptionType, time } from 'discord.js';
import type Context from '#src/core/CommandContext/Context.js';
import BaseCommand from '#src/core/BaseCommand.js';
import { HubService } from '#src/services/HubService.js';
import { hubOption } from '#src/commands/Main/hub/index.js';

export default class HubVisibilitySubcommnd extends BaseCommand {
  constructor() {
    super({
      name: 'visibility',
      description: '👀 Toggle the visibility of a hub (Public/Private).',
      types: { slash: true, prefix: true },
      options: [
        hubOption,
        {
          type: ApplicationCommandOptionType.String,
          name: 'visibility',
          description: 'The visibility of the hub.',
          required: true,
          choices: [
            { name: 'Public', value: 'public' },
            { name: 'Private', value: 'private' },
          ],
        },
      ],

    });
  }
  private readonly hubService = new HubService();

  async execute(ctx: Context) {
    await ctx.deferReply({ flags: ['Ephemeral'] });

    const hubName = ctx.options.getString('hub', true);
    const visibility = ctx.options.getString('visibility', true) as
			| 'public'
			| 'private';
    const hub = (await this.hubService.findHubsByName(hubName)).at(0);

    if (!hub || !(await hub.isManager(ctx.user.id))) {
      await ctx.replyEmbed('hub.notManager', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
      });
      return;
    }

    if (visibility === 'public') {
      await ctx.reply(
        `${ctx.getEmoji('offline_anim')} Checking requirements...`,
      );
      const passedChecks = await this.runPublicRequirementChecks(ctx, hub);
      if (!passedChecks) return;
    }

    await hub.update({ private: visibility === 'private' });

    await ctx.replyEmbed('hub.manage.visibility.success', {
      content: ' ',
      flags: ['Ephemeral'],
      edit: true,
      t: {
        emoji: hub.data.private ? '🔒' : '🔓',
        visibility: hub.data.private ? 'private' : 'public',
      },
    });
  }

  private async runPublicRequirementChecks(ctx: Context, hub: HubManager) {
    const logConfig = await hub.fetchLogConfig();
    const mods = await hub.moderators.fetchAll();
    const requirements = [
      {
        name: 'Hub is older than 24 hours',
        check: hub.data.createdAt < new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { name: 'Hub has atleast 2 moderators', check: mods.size >= 2 },
      {
        name: 'Hub accepts user-reports by setting a log channel for reports',
        check: logConfig.config.reports !== null,
      },
    ];

    const passed = requirements.every((r) => r.check);
    const embed = new InfoEmbed()
      .setTitle('Requirement Summary:')
      .setDescription(stripIndents` 
      Result: **${passed ? `${ctx.getEmoji('tick_icon')} Passed` : `${ctx.getEmoji('x_icon')} Failed`}**

      ${requirements.map((r) => `${r.check ? ctx.getEmoji('tick_icon') : ctx.getEmoji('x_icon')} ${r.name}`).join('\n')}
      ${!passed ? `\n-# ${ctx.getEmoji('info')} Please fix failed requirements and/or try again later.` : ''}
    `);

    await ctx.editReply({
      content: passed
        ? `Continuing ${time(new Date(Date.now() + 10_000), 'R')}...`
        : null,
      embeds: [embed],
    });

    await wait(8000);

    return passed;
  }
}
