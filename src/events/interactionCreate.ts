import BaseEventListener from '#main/core/BaseEventListener.js';
import Constants, { emojis } from '#main/config/Constants.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import { checkIfStaff, handleError, simpleEmbed } from '#main/utils/Utils.js';
import { userData } from '@prisma/client';
import { CacheType, Interaction } from 'discord.js';

export default class InteractionCreate extends BaseEventListener<'interactionCreate'> {
  readonly name = 'interactionCreate';

  async execute(interaction: Interaction<CacheType>) {
    try {
      const { commands, interactions } = interaction.client;
      const dbUser = await db.userData.findFirst({ where: { id: interaction.user.id } });
      const isBanned = await this.handleUserBan(interaction, dbUser);
      if (isBanned) return;

      if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        const ignoreList = ['page_', 'onboarding_', 'shardStats'];
        const customId = CustomID.parseCustomId(interaction.customId);
        if (
          ignoreList.includes(customId.prefix) ||
          ignoreList.some((i) => interaction.customId.includes(i))
        ) {
          return;
        } // for components have own component collector

        // component decorator stuff
        const customIdSuffix = customId.suffix ? `:${customId.suffix}` : '';
        const interactionHandler =
          interactions.get(`${customId.prefix}${customIdSuffix}`) ??
          interactions.get(customId.prefix);
        const isExpiredInteraction = customId.expiry && customId.expiry < Date.now();

        if (isExpiredInteraction) {
          const { userManager } = interaction.client;
          const locale = await userManager.getUserLocale(dbUser);
          await interaction.reply({
            embeds: [simpleEmbed(t({ phrase: 'errors.notUsable', locale }, { emoji: emojis.no }))],
            ephemeral: true,
          });
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

  private async handleUserBan(interaction: Interaction, dbUser: userData | undefined | null) {
    if (dbUser?.banMeta?.reason) {
      if (interaction.isRepliable()) {
        const { userManager } = interaction.client;
        const locale = await userManager.getUserLocale(dbUser);
        await interaction.reply({
          content: t(
            { phrase: 'errors.banned', locale },
            {
              emoji: emojis.no,
              reason: dbUser.banMeta.reason,
              support_invite: Constants.Links.SupportInvite,
            },
          ),
          ephemeral: true,
        });
      }
      return true;
    }
    return false;
  }
}
