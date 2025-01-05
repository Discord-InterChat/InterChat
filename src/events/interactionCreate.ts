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
import type BaseCommand from '#main/core/BaseCommand.js';
import BaseEventListener from '#main/core/BaseEventListener.js';
import { showRulesScreening } from '#main/interactions/RulesScreening.js';
import Constants from '#utils/Constants.js';
import { CustomID, type ParsedCustomId } from '#utils/CustomID.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import { checkIfStaff, handleError } from '#utils/Utils.js';

export default class InteractionCreate extends BaseEventListener<'interactionCreate'> {
  readonly name = 'interactionCreate';

  async execute(interaction: Interaction<CacheType>) {
    try {
      const preCheckResult = await this.performPreChecks(interaction);
      if (!preCheckResult.shouldContinue) return;

      await this.handleInteraction(interaction, preCheckResult.dbUser);
    }
    catch (e) {
      handleError(e, interaction);
    }
  }

  private async performPreChecks(interaction: Interaction) {
    if (this.isInMaintenance(interaction)) {
      return { shouldContinue: false, dbUser: null };
    }

    const dbUser = (await interaction.client.userManager.getUser(interaction.user.id)) ?? null;

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
    const { commands } = interaction.client;
    const command = commands.get(interaction.commandName);

    if (!this.validateCommandAccess(command, interaction)) return;

    if (interaction.isAutocomplete()) {
      await this.handleAutocomplete(command, interaction);
      return;
    }

    await command?.execute(interaction);
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

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(dbUser);
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
        flags: 'Ephemeral',
      })
      .catch(() => null);
    return true;
  }

  private async isUserBanned(interaction: Interaction, dbUser: UserData | undefined | null) {
    if (!dbUser?.banReason) {
      return false;
    }

    if (interaction.isRepliable()) {
      const { userManager } = interaction.client;
      const locale = await userManager.getUserLocale(dbUser);
      await interaction.reply({
        content: t('errors.banned', locale, {
          emoji: this.getEmoji('x_icon'),
          support_invite: Constants.Links.SupportInvite,
        }),
        flags: 'Ephemeral',
      });
    }
    return true;
  }
}
