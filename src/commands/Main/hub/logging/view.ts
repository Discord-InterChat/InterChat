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

import HubCommand, { hubOption } from '#src/commands/Main/hub/index.js';
import HubLoggingSetSubcommand from './set.js';
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import type { AutocompleteInteraction } from 'discord.js';
import { HubService } from '#src/services/HubService.js';

export default class LoggingViewSubcommand extends BaseCommand {
  private readonly hubService = new HubService();

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

  async autocomplete(interaction: AutocompleteInteraction) {
    return await HubCommand.handleManagerCmdAutocomplete(interaction, this.hubService);
  }
}
