import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { handleError } from '#main/utils/Utils.js';
import Constants, { emojis } from '#utils/Constants.js';
import { CustomID } from '#utils/CustomID.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { supportedLocaleCodes, t } from '#utils/Locale.js';
import { UserData } from '@prisma/client';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Interaction,
  Message,
  type ButtonInteraction,
} from 'discord.js';

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
        emoji: emojis.wave_anim,
        user: author.username,
      }),
      components: [buttons],
    };

    if (repliable instanceof Message) {
      await repliable.reply(welcomeMsg);
    }
    else if (repliable.isRepliable()) {
      await repliable.reply({ ...welcomeMsg, ephemeral: true });
    }
  }
  catch (e) {
    handleError(e, e instanceof Message ? undefined : e);
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
          new InfoEmbed({ description: t('errors.notYourAction', 'en', { emoji: emojis.no }) }),
        ],
        ephemeral: true,
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
        t('rules.accepted', locale, { emoji: emojis.yes, guide: Constants.Links.Docs }),
      );

      await interaction.editReply({ embeds: [embed], components: [] });
    }
    else {
      await interaction.deleteReply();
    }
  }

  private async showRules(interaction: ButtonInteraction, locale: supportedLocaleCodes) {
    const rulesEmbed = new InfoEmbed()
      .setDescription(t('rules.rules', locale, { support_invite: Constants.Links.SupportInvite }))
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
      ephemeral: true,
    });
  }

  private async acceptRules(interaction: ButtonInteraction, locale: supportedLocaleCodes) {
    const { userManager } = interaction.client;
    const userData = await userManager.getUser(interaction.user.id);

    if (this.hasAlreadyAccepted(interaction, userData, locale)) return { success: false };

    await userManager.updateUser(interaction.user.id, { acceptedRules: true });

    return { success: true };
  }

  private hasAlreadyAccepted(
    interaction: ButtonInteraction,
    userData: UserData | null | undefined,
    locale: supportedLocaleCodes,
  ) {
    if (!userData?.acceptedRules) return false;

    const embed = new InfoEmbed().setDescription(
      t('rules.alreadyAccepted', locale, { emoji: emojis.yes }),
    );
    interaction.reply({ embeds: [embed], ephemeral: true }).catch(handleError);

    return true;
  }
}
