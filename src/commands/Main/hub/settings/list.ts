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
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { HubService } from '#src/services/HubService.js';
import { runHubPermissionChecksAndReply } from '#src/utils/hub/utils.js';
import type { AutocompleteInteraction } from 'discord.js';

export default class HubSettingsListSubcommand extends BaseCommand {
  private readonly hubService = new HubService();

  constructor() {
    super({
      name: 'list',
      description: '🔎 List all the settings of the hub.',
      types: { slash: true, prefix: true },
      options: [hubOption],
    });
  }

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

  async autocomplete(interaction: AutocompleteInteraction) {
    return await HubCommand.handleManagerCmdAutocomplete(interaction, this.hubService);
  }
}
