import BaseEventListener from '#main/core/BaseEventListener.js';
import { showRulesScreening } from '#main/interactions/RulesScreening.js';
import Constants, { emojis } from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import { checkIfStaff, handleError } from '#utils/Utils.js';
import { UserData } from '@prisma/client';
import {
  CacheType,
  Interaction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from 'discord.js';

export default class InteractionCreate extends BaseEventListener<'interactionCreate'> {
  readonly name = 'interactionCreate';

  async execute(interaction: Interaction<CacheType>) {
    try {
      if (this.isInMaintenance(interaction)) return;

      const dbUser = (await interaction.client.userManager.getUser(interaction.user.id)) ?? null;

      if (await this.isUserBanned(interaction, dbUser)) return;
      if (this.shouldShowRules(interaction, dbUser)) {
        return await showRulesScreening(interaction, dbUser);
      }

      if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        await this.handleModalsAndComponents(interaction, dbUser);
      }
      else {
        const { commands } = interaction.client;
        const command = commands.get(interaction.commandName);
        if (command?.staffOnly && !checkIfStaff(interaction.user.id)) return;

        if (interaction.isAutocomplete()) {
          if (command?.autocomplete) await command.autocomplete(interaction);
        }
        else {
          await command?.execute(interaction);
        }
      }
    }
    catch (e) {
      handleError(e, interaction);
    }
  }

  private shouldShowRules(interaction: Interaction, dbUser: UserData | null) {
    // don't show rules again if user is clicking on the rules screen buttons
    return (
      dbUser?.acceptedRules === false &&
      (interaction.isButton() &&
        CustomID.parseCustomId(interaction.customId).prefix === 'rulesScreen') === false
    );
  }

  private async handleModalsAndComponents(
    interaction: ModalSubmitInteraction | MessageComponentInteraction,
    dbUser: UserData | null,
  ) {
    const customId = CustomID.parseCustomId(interaction.customId);

    // component decorator stuff
    const { interactions } = interaction.client;
    const customIdSuffix = customId.suffix ? `:${customId.suffix}` : '';
    const interactionHandler =
      interactions.get(`${customId.prefix}${customIdSuffix}`) ?? interactions.get(customId.prefix);
    const isExpiredInteraction = customId.expiry && customId.expiry < Date.now();

    if (isExpiredInteraction) {
      const { userManager } = interaction.client;
      const locale = await userManager.getUserLocale(dbUser);
      const embed = new InfoEmbed({
        description: t('errors.notUsable', locale, { emoji: emojis.slash }),
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interactionHandler) await interactionHandler(interaction);
  }

  private isInMaintenance(interaction: Interaction) {
    if (interaction.client.cluster.maintenance && interaction.isRepliable()) {
      interaction
        .reply({
          content: `${emojis.slash} The bot is currently undergoing maintenance. Please try again later.`,
          ephemeral: true,
        })
        .catch(() => null);
      return true;
    }
    return false;
  }

  private async isUserBanned(interaction: Interaction, dbUser: UserData | undefined | null) {
    if (dbUser?.banMeta?.reason) {
      if (interaction.isRepliable()) {
        const { userManager } = interaction.client;
        const locale = await userManager.getUserLocale(dbUser);
        await interaction.reply({
          content: t('errors.banned', locale, {
            emoji: emojis.no,
            support_invite: Constants.Links.SupportInvite,
          }),
          ephemeral: true,
        });
      }
      return true;
    }
    return false;
  }
}
