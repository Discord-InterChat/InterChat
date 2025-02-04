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
import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import HubSettingsManager from '#src/managers/HubSettingsManager.js';
import {
  HubSettingsBits,
  type HubSettingsString,
} from '#src/modules/BitFields.js';
import { HubService } from '#src/services/HubService.js';
import { CustomID } from '#src/utils/CustomID.js';
import { ErrorEmbed } from '#src/utils/EmbedUtils.js';
import { executeHubRoleChecksAndReply } from '#src/utils/hub/utils.js';
import { t } from '#src/utils/Locale.js';
import { fetchUserLocale } from '#src/utils/Utils.js';
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  type AutocompleteInteraction,
  type ButtonInteraction,
} from 'discord.js';

export default class SettingsToggleSubcommand extends BaseCommand {
  private readonly hubService = new HubService();

  constructor() {
    super({
      name: 'toggle',
      description: '⚡⚙️ Toggle a setting of the hub.',
      types: { slash: true, prefix: true },
      options: [
        {
          name: 'setting',
          description: 'The setting to toggle.',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: Object.keys(HubSettingsBits).map((s) => ({
            name: s,
            value: s,
          })),
        },
        hubOption,
      ],
    });
  }

  async execute(ctx: Context) {
    const hubName = ctx.options.getString('hub');
    const hub = hubName
      ? (await this.hubService.findHubsByName(hubName)).at(0)
      : null;

    if (
      !hub ||
			!(await executeHubRoleChecksAndReply(hub, ctx, {
			  checkIfManager: true,
			}))
    ) return;

    const settingStr = ctx.options.getString(
      'setting',
      true,
    ) as HubSettingsString;
    const value = await hub.settings.updateSetting(settingStr);
    const viewSettingsButton =
			new ActionRowBuilder<ButtonBuilder>().addComponents(
			  new ButtonBuilder()
			    .setCustomId(
			      new CustomID()
			        .setIdentifier('hubSettings', 'list')
			        .setArgs(hub.id, ctx.user.id)
			        .toString(),
			    )
			    .setLabel('View Settings')
			    .setEmoji(ctx.getEmoji('settings'))
			    .setStyle(ButtonStyle.Secondary),
			);

    await ctx.replyEmbed(
      `Setting \`${settingStr}\` is now **${value ? `${ctx.getEmoji('enabled')} enabled` : `${ctx.getEmoji('disabled')} disabled`}**.`,
      { flags: ['Ephemeral'], components: [viewSettingsButton] },
    );
  }

  async autocomplete(interaction: AutocompleteInteraction) {
    return await HubCommand.handleManagerCmdAutocomplete(interaction, this.hubService);
  }

  @RegisterInteractionHandler('hubSettings')
  async handleButtons(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    if (customId.suffix !== 'list') return;

    const [hubId, userId] = customId.args;

    if (interaction.user.id !== userId) {
      const embed = new ErrorEmbed(interaction.client).setDescription(
        t('errors.notYourAction', await fetchUserLocale(interaction.user.id)),
      );
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    }

    const settingsManager = await HubSettingsManager.create(hubId);
    await interaction.reply({
      embeds: [settingsManager.getEmbed(interaction.client)],
      flags: ['Ephemeral'],
    });
  }
}
