/*
 * Copyright (C) 2025 InterChat
 *
 * InterChat is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * InterChat is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with InterChat.  If not, see <https://www.gnu.org/licenses/>.
 */

import { blockwordRuleAndHubAutocomplete } from '#src/commands/Main/hub/blockwords/edit.js';
import { hubOption } from '#src/commands/Main/hub/index.js';
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { HubService } from '#src/services/HubService.js';
import db from '#src/utils/Db.js';
import {
  executeHubRoleChecksAndReply,
  fetchHub,
} from '#src/utils/hub/utils.js';
import {
  ApplicationCommandOptionType,
  type AutocompleteInteraction,
} from 'discord.js';

export default class HubBlockwordsDeleteSubcommand extends BaseCommand {
  private readonly hubService = new HubService();

  constructor() {
    super({
      name: 'delete',
      types: { slash: true, prefix: true },
      description: '❌ Delete a block word rule from your hub.',
      options: [
        hubOption,
        {
          name: 'rule',
          description: 'The rule to delete.',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    });
  }

  public async execute(ctx: Context) {
    const hubName = ctx.options.getString('hub') ?? undefined;

    const hub = await fetchHub({ name: hubName });
    if (
      !hub ||
			!(await executeHubRoleChecksAndReply(hub, ctx, { checkIfManager: true }))
    ) return;

    const blockWords = await hub.fetchBlockWords();
    const ruleName = ctx.options.getString('rule');
    const rule = blockWords.find((r) => r.name === ruleName);

    if (!rule) {
      await ctx.replyEmbed('hub.blockwords.notFound', {
        t: { emoji: ctx.getEmoji('x_icon') },
        flags: ['Ephemeral'],
      });
      return;
    }

    await ctx.replyEmbed('hub.blockwords.deleting', {
      t: { emoji: ctx.getEmoji('loading') },
    });

    await db.blockWord.delete({ where: { id: rule.id } });

    await ctx.replyEmbed('hub.blockwords.deleted', {
      t: { emoji: ctx.getEmoji('tick_icon') },
      edit: true,
    });
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    await blockwordRuleAndHubAutocomplete(interaction, this.hubService);
  }
}
