import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import HubCommand from '#main/commands/slash/Main/hub/index.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import type HubManager from '#main/managers/HubManager.js';
import HubSettingsManager from '#main/managers/HubSettingsManager.js';
import type { HubSettingsString } from '#main/modules/BitFields.js';
import { CustomID } from '#utils/CustomID.js';
import { t } from '#utils/Locale.js';

export default class Settings extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    const hub = await this.runHubCheck(interaction);
    if (!hub) return;

    if (subcommand === 'list') {
      await this.handleList(interaction, hub);
    }
    else if (subcommand === 'toggle') {
      await this.handleToggle(interaction, hub);
    }
  }

  private async handleList(interaction: ChatInputCommandInteraction, hub: HubManager) {
    await interaction.reply({
      embeds: [hub.settings.getEmbed(interaction.client)],
    });
  }

  private async handleToggle(interaction: ChatInputCommandInteraction, hub: HubManager) {
    const settingStr = interaction.options.getString('setting', true) as HubSettingsString;
    const value = await hub.settings.updateSetting(settingStr);
    const viewSettingsButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('hubSettings', 'list')
            .setArgs(hub.id, interaction.user.id)
            .toString(),
        )
        .setLabel('View Settings')
        .setEmoji(this.getEmoji('settings'))
        .setStyle(ButtonStyle.Secondary),
    );

    await this.replyEmbed(
      interaction,
      `Setting \`${settingStr}\` is now **${value ? `${this.getEmoji('enabled')} enabled` : `${this.getEmoji('disabled')} disabled`}**.`,
      { flags: 'Ephemeral', components: [viewSettingsButton] },
    );
  }

  @RegisterInteractionHandler('hubSettings')
  async handleButtons(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    if (customId.suffix !== 'list') return;

    const [hubId, userId] = customId.args;

    if (interaction.user.id !== userId) {
      await this.replyEmbed(
        interaction,
        t(
          'errors.notYourAction',
          await interaction.client.userManager.getUserLocale(interaction.user.id),
        ),
        { flags: ['Ephemeral'] },
      );
    }

    const settingsManager = await HubSettingsManager.create(hubId);
    await interaction.reply({
      embeds: [settingsManager.getEmbed(interaction.client)],
      flags: 'Ephemeral',
    });
  }
  private async runHubCheck(interaction: ChatInputCommandInteraction) {
    const hubName = interaction.options.getString('hub') as string | undefined;
    const hub = hubName ? (await this.hubService.findHubsByName(hubName)).at(0) : null;

    if (!(await hub?.isManager(interaction.user.id))) {
      await this.replyEmbed(
        interaction,
        'Hub not found. Provide a valid hub in the `hub` option of the command.',
        { flags: ['Ephemeral'] },
      );
      return null;
    }

    return hub;
  }
}
