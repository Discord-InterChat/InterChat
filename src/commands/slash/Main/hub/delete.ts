import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { HubService } from '#main/services/HubService.js';
import { setComponentExpiry } from '#utils/ComponentUtils.js';

import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import HubCommand from './index.js';

export default class Delete extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hubName = interaction.options.getString('hub', true);

    const hub = (await this.hubService.getOwnedHubs(interaction.user.id)).find(
      (h) => h.data.name === hubName,
    );

    if (!hub) {
      const infoEmbed = new InfoEmbed().setDescription(
        t('hub.notOwner', await interaction.client.userManager.getUserLocale(interaction.user.id), {
          emoji: this.getEmoji('x_icon'),
        }),
      );
      await interaction.reply({ embeds: [infoEmbed], flags: ['Ephemeral'] });
      return;
    }

    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    const confirmEmbed = new EmbedBuilder()
      .setDescription(t('hub.delete.confirm', locale, { hub: hub.data.name }))
      .setColor('Red');
    const confirmButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Confirm')
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_delete', 'confirm')
            .setArgs(interaction.user.id)
            .setArgs(hub.id)
            .toString(),
        )
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setLabel('Cancel')
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_delete', 'cancel')
            .setArgs(interaction.user.id)
            .setArgs(hub.id)
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      embeds: [confirmEmbed],
      components: [confirmButtons],
    });

    setComponentExpiry(interaction.client.getScheduler(), await interaction.fetchReply(), 10_000);
  }

  @RegisterInteractionHandler('hub_delete')
  override async handleComponents(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [userId, hubId] = customId.args;
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);

    if (interaction.user.id !== userId) {
      const infoEmbed = new InfoEmbed().setDescription(
        t('hub.delete.ownerOnly', locale, { emoji: this.getEmoji('x_icon') }),
      );

      await interaction.reply({ embeds: [infoEmbed], flags: ['Ephemeral'] });
      return;
    }

    if (customId.suffix === 'cancel') {
      const infoEmbed = new InfoEmbed().setDescription(
        t('hub.delete.cancelled', locale, { emoji: this.getEmoji('x_icon') }),
      );

      await interaction.update({ embeds: [infoEmbed], components: [] });
      return;
    }

    const embed = new InfoEmbed().setDescription(
      t('global.loading', locale, { emoji: this.getEmoji('loading') }),
    );

    await interaction.update({ embeds: [embed], components: [] });

    const hubService = new HubService(db);
    const hubInDb = await hubService.fetchHub(hubId);

    // only the owner can delete the hub
    if (!hubInDb?.isOwner(interaction.user.id)) {
      const infoEmbed = new InfoEmbed().setDescription(
        t('hub.notFound', locale, { emoji: this.getEmoji('x_icon') }),
      );

      await interaction.editReply({ embeds: [infoEmbed] });
      return;
    }

    // Delete the hub and all related data
    await hubService.deleteHub(hubInDb.id);

    await interaction.editReply({
      content: t('hub.delete.success', locale, {
        emoji: this.getEmoji('tick'),
        hub: hubInDb.data.name,
      }),
      embeds: [],
    });
  }
}
