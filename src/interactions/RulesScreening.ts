import type { UserData } from '@prisma/client';
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type Interaction,
  Message,
} from 'discord.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';
import Logger from '#main/utils/Logger.js';
import { getReplyMethod, handleError } from '#main/utils/Utils.js';
import Constants from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';

export const showRulesScreening = async (
  repliable: Interaction | Message,
  userData?: UserData | null,
) => {
  try {
    const author = repliable instanceof Message ? repliable.author : repliable.user;

    const locale = await repliable.client.userManager.getUserLocale(userData);
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(new CustomID('rulesScreen:continue', [author.id]).toString())
        .setLabel('Continue')
        .setStyle(ButtonStyle.Success),
    );

    const welcomeMsg = {
      content: t('rules.welcome', locale, {
        emoji: getEmoji('wave_anim', repliable.client),
        user: author.username,
      }),
      components: [buttons],
    };

    if (repliable instanceof Message) {
      await repliable.reply(welcomeMsg);
    }
    else if (repliable.isRepliable()) {
      await repliable.reply({ ...welcomeMsg, flags: ['Ephemeral'] });
    }
  }
  catch (e) {
    Logger.error(e);
  }
};

export default class RulesScreeningInteraction {
  @RegisterInteractionHandler('rulesScreen', 'continue')
  async inactiveConnect(interaction: ButtonInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [userId] = customId.args;

    if (interaction.user.id !== userId) {
      await interaction.reply({
        embeds: [
          new InfoEmbed({
            description: t('errors.notYourAction', 'en', {
              emoji: getEmoji('x_icon', interaction.client),
            }),
          }),
        ],
        flags: 'Ephemeral',
      });
      return;
    }

    const { userManager } = interaction.client;
    const userData = await userManager.getUser(userId);
    const locale = await userManager.getUserLocale(userData);

    if (this.hasAlreadyAccepted(interaction, userData, locale)) return;

    await this.showRules(interaction, locale).catch(handleError);
  }

  @RegisterInteractionHandler('rulesScreen')
  async handleRulesResponse(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const customId = CustomID.parseCustomId(interaction.customId);

    if (customId.suffix === 'accept') {
      const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);

      const { success } = await this.acceptRules(interaction, locale);
      if (!success) return;

      const embed = new InfoEmbed().setDescription(
        t('rules.accepted', locale, {
          emoji: getEmoji('tick_icon', interaction.client),
          support_invite: Constants.Links.SupportInvite,
          donateLink: Constants.Links.Donate,
        }),
      );

      await interaction.editReply({ embeds: [embed], components: [] });
    }
    else {
      await interaction.deleteReply();
    }
  }

  private async showRules(interaction: ButtonInteraction, locale: supportedLocaleCodes) {
    const rulesEmbed = new InfoEmbed()
      .setDescription(
        t('rules.rules', locale, {
          rules_emoji: getEmoji('rules_icon', interaction.client),
        }),
      )
      .setImage(Constants.Links.RulesBanner)
      .setColor(Constants.Colors.interchatBlue);

    const components = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(new CustomID('rulesScreen:accept').toString())
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(new CustomID('rulesScreen:decline').toString())
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({
      embeds: [rulesEmbed],
      components: [components],
      flags: 'Ephemeral',
    });
  }

  private async acceptRules(interaction: ButtonInteraction, locale: supportedLocaleCodes) {
    const { userManager } = interaction.client;
    const userData = await userManager.getUser(interaction.user.id);

    if (this.hasAlreadyAccepted(interaction, userData, locale)) return { success: false };

    await userManager.upsertUser(interaction.user.id, { acceptedRules: true });

    return { success: true };
  }

  private hasAlreadyAccepted(
    interaction: ButtonInteraction,
    userData: UserData | null | undefined,
    locale: supportedLocaleCodes,
  ) {
    if (!userData?.acceptedRules) return false;
    const embed = new InfoEmbed().setDescription(
      t('rules.alreadyAccepted', locale, {
        emoji: getEmoji('tick_icon', interaction.client),
      }),
    );

    const replyMethod = getReplyMethod(interaction);
    interaction[replyMethod]({ embeds: [embed], flags: ['Ephemeral'] }).catch(handleError);

    return true;
  }
}
