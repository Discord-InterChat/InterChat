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

import type { UserData } from '@prisma/client';
import type {
  AutocompleteInteraction,
  CacheType,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  Interaction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import type BaseCommand from '#src/core/BaseCommand.js';
import BaseEventListener from '#src/core/BaseEventListener.js';
import { showRulesScreening } from '#src/interactions/RulesScreening.js';
import Constants from '#utils/Constants.js';
import { CustomID, type ParsedCustomId } from '#utils/CustomID.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import { checkIfStaff, fetchUserData, fetchUserLocale, handleError } from '#utils/Utils.js';
import { executeCommand, resolveCommand } from '#src/utils/CommandUtils.js';

export default class InteractionCreate extends BaseEventListener<'interactionCreate'> {
  readonly name = 'interactionCreate';

  async execute(interaction: Interaction<CacheType>) {
    try {
      const preCheckResult = await this.performPreChecks(interaction);
      if (!preCheckResult.shouldContinue) return;

      await this.handleInteraction(interaction, preCheckResult.dbUser);
    }
    catch (e) {
      handleError(e, { repliable: interaction });
    }
  }

  private async performPreChecks(interaction: Interaction) {
    if (this.isInMaintenance(interaction)) {
      return { shouldContinue: false, dbUser: null };
    }

    const dbUser = await fetchUserData(interaction.user.id);

    if (await this.isUserBanned(interaction, dbUser)) {
      return { shouldContinue: false, dbUser: null };
    }

    if (this.shouldShowRules(interaction, dbUser)) {
      await showRulesScreening(interaction, dbUser);
      return { shouldContinue: false, dbUser: null };
    }

    return { shouldContinue: true, dbUser };
  }

  private async handleInteraction(interaction: Interaction, dbUser: UserData | null) {
    if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
      await this.handleComponentOrModal(interaction, dbUser);
      return;
    }

    await this.handleCommand(interaction);
  }

  private async handleCommand(
    interaction:
      | ChatInputCommandInteraction
      | ContextMenuCommandInteraction
      | AutocompleteInteraction,
  ) {
    const { command } = resolveCommand(interaction);
    if (!command) return;

    if (!this.validateCommandAccess(command, interaction)) return;

    if (interaction.isAutocomplete()) {
      await this.handleAutocomplete(command, interaction);
      return;
    }

    await executeCommand(interaction, command);
  }

  private validateCommandAccess(
    command: BaseCommand | undefined,
    interaction: Interaction | ContextMenuCommandInteraction,
  ) {
    if (command?.staffOnly && !checkIfStaff(interaction.user.id)) {
      return false;
    }
    return true;
  }

  private async handleAutocomplete(
    command: BaseCommand | undefined,
    interaction: AutocompleteInteraction,
  ) {
    if (command?.autocomplete) {
      await command.autocomplete(interaction);
    }
  }

  private async handleComponentOrModal(
    interaction: ModalSubmitInteraction | MessageComponentInteraction,
    dbUser: UserData | null,
  ) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const handler = this.getInteractionHandler(interaction, customId);

    if (await this.isExpiredInteraction(interaction, customId, dbUser)) {
      return;
    }

    if (handler) await handler(interaction);
  }

  private getInteractionHandler(
    interaction: MessageComponentInteraction | ModalSubmitInteraction,
    customId: ParsedCustomId,
  ) {
    const { interactions } = interaction.client;
    const customIdSuffix = customId.suffix ? `:${customId.suffix}` : '';
    return (
      interactions.get(`${customId.prefix}${customIdSuffix}`) ?? interactions.get(customId.prefix)
    );
  }

  private async isExpiredInteraction(
    interaction: MessageComponentInteraction | ModalSubmitInteraction,
    customId: ParsedCustomId,
    dbUser: UserData | null,
  ) {
    if (!customId.expiry || customId.expiry >= Date.now()) {
      return false;
    }

    const locale = dbUser ? await fetchUserLocale(dbUser) : 'en';
    const embed = new InfoEmbed({
      description: t('errors.notUsable', locale, {
        emoji: this.getEmoji('slash'),
      }),
    });

    await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    return true;
  }

  private shouldShowRules(interaction: Interaction, dbUser: UserData | null) {
    const isRulesScreenButton =
      interaction.isButton() &&
      CustomID.parseCustomId(interaction.customId).prefix === 'rulesScreen';

    return dbUser?.acceptedRules === false && !isRulesScreenButton;
  }

  private isInMaintenance(interaction: Interaction) {
    if (!interaction.client.cluster.maintenance || !interaction.isRepliable()) {
      return false;
    }

    interaction
      .reply({
        content: `${this.getEmoji('slash')} The bot is currently undergoing maintenance. Please try again later.`,
        flags: ['Ephemeral'],
      })
      .catch(() => null);
    return true;
  }

  private async isUserBanned(interaction: Interaction, dbUser: UserData | undefined | null) {
    if (!dbUser?.banReason) {
      return false;
    }

    if (interaction.isRepliable()) {
      const locale = await fetchUserLocale(dbUser);
      await interaction.reply({
        content: t('errors.banned', locale, {
          emoji: this.getEmoji('x_icon'),
          support_invite: Constants.Links.SupportInvite,
        }),
        flags: ['Ephemeral'],
      });
    }
    return true;
  }
}
