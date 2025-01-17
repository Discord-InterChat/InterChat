import {
  ActionRowBuilder,
  type CacheType,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { HubValidator } from '#main/modules/HubValidator.js';
import type { HubCreationData } from '#main/services/HubService.js';
import { CustomID } from '#main/utils/CustomID.js';
import { fetchUserLocale, handleError } from '#main/utils/Utils.js';
import Constants from '#utils/Constants.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import HubCommand from './index.js';

export default class Create extends HubCommand {
  readonly cooldown = 10 * 60 * 1000; // 10 mins

  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    const locale = await fetchUserLocale(interaction.user.id);

    if (await this.isOnCooldown(interaction, locale)) return;

    const modal = new ModalBuilder()
      .setTitle(t('hub.create.modal.title', locale))
      .setCustomId(new CustomID('hub_create_modal').toString())
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setLabel(t('hub.create.modal.name.label', locale))
            .setPlaceholder(t('hub.create.modal.name.placeholder', locale))
            .setMinLength(2)
            .setMaxLength(100)
            .setStyle(TextInputStyle.Short)
            .setCustomId('name'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setLabel(t('hub.create.modal.description.label', locale))
            .setPlaceholder(t('hub.create.modal.description.placeholder', locale))
            .setMaxLength(1024)
            .setStyle(TextInputStyle.Paragraph)
            .setCustomId('description'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setLabel(t('hub.create.modal.icon.label', locale))
            .setPlaceholder(t('hub.create.modal.icon.placeholder', locale))
            .setMaxLength(300)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setCustomId('icon'),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setLabel(t('hub.create.modal.banner.label', locale))
            .setPlaceholder(t('hub.create.modal.banner.placeholder', locale))
            .setMaxLength(300)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setCustomId('banner'),
        ),
        // new ActionRowBuilder<TextInputBuilder>().addComponents(
        //   new TextInputBuilder()
        //     .setLabel('Language')
        //     .setPlaceholder('Pick a language for this hub.')
        //     .setStyle(TextInputStyle.Short)
        //     .setCustomId('language'),
        // ),
      );

    await interaction.showModal(modal);
  }

  private async isOnCooldown(
    interaction: ChatInputCommandInteraction<CacheType>,
    locale: supportedLocaleCodes,
  ): Promise<boolean> {
    const remainingCooldown = await this.getRemainingCooldown(interaction);
    if (remainingCooldown) {
      await this.sendCooldownError(interaction, remainingCooldown, locale);
      return true;
    }
    return false;
  }

  @RegisterInteractionHandler('hub_create_modal')
  async handleModals(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: ['Ephemeral'] });

    const locale = await fetchUserLocale(interaction.user.id);

    try {
      const hubData = this.extractHubData(interaction);
      await this.processHubCreation(interaction, hubData, locale);
    }
    catch (error) {
      handleError(error, { repliable: interaction });
    }
  }

  private extractHubData(interaction: ModalSubmitInteraction): HubCreationData {
    return {
      name: interaction.fields.getTextInputValue('name'),
      description: interaction.fields.getTextInputValue('description'),
      iconUrl: interaction.fields.getTextInputValue('icon'),
      bannerUrl: interaction.fields.getTextInputValue('banner'),
      ownerId: interaction.user.id,
    };
  }

  private async processHubCreation(
    interaction: ModalSubmitInteraction,
    hubData: HubCreationData,
    locale: supportedLocaleCodes,
  ): Promise<void> {
    const validator = new HubValidator(locale, interaction.client);
    const existingHubs = await this.hubService.getExistingHubs(hubData.ownerId, hubData.name);

    const validationResult = await validator.validateNewHub(hubData, existingHubs);
    if (!validationResult.isValid) {
      await interaction.followUp({
        content: validationResult.error,
        flags: ['Ephemeral'],
      });
      return;
    }

    await this.hubService.createHub(hubData);
    await this.handleSuccessfulCreation(interaction, hubData.name, locale);
  }

  private async handleSuccessfulCreation(
    interaction: ModalSubmitInteraction,
    hubName: string,
    locale: supportedLocaleCodes,
  ): Promise<void> {
    this.setCooldowns(interaction);

    const successEmbed = new EmbedBuilder()
      .setColor('Green')
      .setDescription(
        t('hub.create.success', locale, {
          name: hubName,
          support_invite: Constants.Links.SupportInvite,
          donateLink: Constants.Links.Donate,
        }),
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  }

  private setCooldowns(interaction: ModalSubmitInteraction): void {
    interaction.client.commandCooldowns.setCooldown(
      `${interaction.user.id}-hub-create`,
      60 * 60 * 1000, // 1 hour
    );

    const command = HubCommand.subcommands.get('create');
    command?.setUserCooldown(interaction);
  }
}
