import HubCommand from '#main/commands/slash/Main/hub/index.js';
import { emojis } from '#main/config/Constants.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { type HubSettingsString } from '#main/modules/BitFields.js';
import HubSettingsManager from '#main/managers/HubSettingsManager.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { t } from '#main/utils/Locale.js';
import type { Hub } from '@prisma/client';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';

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

  private async handleList(interaction: ChatInputCommandInteraction, hub: Hub) {
    const settingsManager = new HubSettingsManager(hub.id, hub.settings);

    await interaction.reply({ embeds: [settingsManager.settingsEmbed] });
  }

  private async handleToggle(interaction: ChatInputCommandInteraction, hub: Hub) {
    const settingStr = interaction.options.getString('setting', true) as HubSettingsString;
    const settingsManager = new HubSettingsManager(hub.id, hub.settings);

    const value = await settingsManager.updateSetting(settingStr);
    const viewSettingsButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          new CustomID()
            .setIdentifier('hubSettings', 'list')
            .addArgs(hub.id, interaction.user.id)
            .toString(),
        )
        .setLabel('View Settings')
        .setEmoji(emojis.settings)
        .setStyle(ButtonStyle.Secondary),
    );

    await this.replyEmbed(
      interaction,
      `Setting \`${settingStr}\` is now **${value ? `${emojis.enabled} enabled` : `${emojis.disabled} disabled`}**.`,
      { ephemeral: true, components: [viewSettingsButton] },
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
        t({
          phrase: 'errors.notYourAction',
          locale: await interaction.client.userManager.getUserLocale(interaction.user.id),
        }),
        { ephemeral: true },
      );
    }

    const settingsManager = await HubSettingsManager.create(hubId);
    await interaction.reply({ embeds: [settingsManager.settingsEmbed], ephemeral: true });
  }
  private async runHubCheck(interaction: ChatInputCommandInteraction) {
    const hubName = interaction.options.getString('hub') as string | undefined;
    const hub = await db.hub.findFirst({
      where: {
        name: hubName,
        OR: [
          { ownerId: interaction.user.id },
          { moderators: { some: { userId: interaction.user.id, position: 'manager' } } },
        ],
      },
    });

    if (!hub) {
      await this.replyEmbed(
        interaction,
        'Hub not found. Provide a valid hub in the `hub` option of the command.',
        { ephemeral: true },
      );
      return null;
    }

    return hub;
  }
}
