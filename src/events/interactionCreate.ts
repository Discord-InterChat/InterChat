import Constants, { emojis } from '#main/config/Constants.js';
import BaseEventListener from '#main/core/BaseEventListener.js';
import { CustomID } from '#utils/CustomID.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import { checkIfStaff, handleError } from '#utils/Utils.js';
import { UserData } from '@prisma/client';
import { CacheType, Interaction } from 'discord.js';

export default class InteractionCreate extends BaseEventListener<'interactionCreate'> {
  readonly name = 'interactionCreate';

  async execute(interaction: Interaction<CacheType>) {
    try {
      if (interaction.client.cluster.maintenance) {
        if (interaction.isRepliable()) {
          await interaction.reply({
            content: `${emojis.slash} The bot is currently undergoing maintenance. Please try again later.`,
            ephemeral: true,
          });
        }

        return;
      }

      const { commands, interactions } = interaction.client;
      const dbUser = await interaction.client.userManager.getUser(interaction.user.id);
      const isBanned = await this.handleUserBan(interaction, dbUser);
      if (isBanned) return;

      if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        const customId = CustomID.parseCustomId(interaction.customId);

        // component decorator stuff
        const customIdSuffix = customId.suffix ? `:${customId.suffix}` : '';
        const interactionHandler =
          interactions.get(`${customId.prefix}${customIdSuffix}`) ??
          interactions.get(customId.prefix);
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
        return;
      }

      const command = commands.get(interaction.commandName);
      if (command?.staffOnly && !checkIfStaff(interaction.user.id)) return;

      // slash commands
      if (!interaction.isAutocomplete()) await command?.execute(interaction);
      // autocompletes
      else if (command?.autocomplete) await command.autocomplete(interaction);
    }
    catch (e) {
      handleError(e, interaction);
    }
  }

  private async handleUserBan(interaction: Interaction, dbUser: UserData | undefined | null) {
    if (dbUser?.banMeta?.reason) {
      if (interaction.isRepliable()) {
        const { userManager } = interaction.client;
        const locale = await userManager.getUserLocale(dbUser);
        await interaction.reply({
          content: t('errors.banned', locale, {
            emoji: emojis.no,
            reason: dbUser.banMeta.reason,
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
