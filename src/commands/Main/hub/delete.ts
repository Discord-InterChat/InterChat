import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import { HubService } from '#src/services/HubService.js';

import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import { runHubPermissionChecksAndReply } from '#src/utils/hub/utils.js';
import { escapeRegexChars, fetchUserLocale } from '#src/utils/Utils.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { t } from '#utils/Locale.js';
import {
  ActionRowBuilder,
  type AutocompleteInteraction,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import HubCommand, { hubOption } from '#src/commands/Main/hub/index.js';

export default class HubDeleteSubcommand extends BaseCommand {
  private readonly hubService = new HubService();

  constructor() {
    super({
      name: 'delete',
      description: '🗑️ Delete a hub you own.',
      types: { slash: true, prefix: true },
      options: [hubOption],
    });
  }

  async execute(ctx: Context): Promise<void> {
    const hubName = ctx.options.getString('hub', true);
    const hub = (await this.hubService.getOwnedHubs(ctx.user.id)).find(
      (h) => h.data.name === hubName,
    );

    const locale = await ctx.getLocale();
    if (
      !hub ||
			!(await runHubPermissionChecksAndReply(hub, ctx, { checkIfOwner: true }))
    ) return;

    const confirmEmbed = new EmbedBuilder()
      .setDescription(t('hub.delete.confirm', locale, { hub: hub.data.name }))
      .setColor('Red');
    const confirmButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Confirm')
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_delete', 'confirm')
            .setArgs(ctx.user.id)
            .setArgs(hub.id)
            .toString(),
        )
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setLabel('Cancel')
        .setCustomId(
          new CustomID()
            .setIdentifier('hub_delete', 'cancel')
            .setArgs(ctx.user.id)
            .setArgs(hub.id)
            .toString(),
        )
        .setStyle(ButtonStyle.Secondary),
    );

    await ctx.reply({
      embeds: [confirmEmbed],
      components: [confirmButtons],
    });
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = escapeRegexChars(interaction.options.getFocused());
    const hubChoices = await HubCommand.getOwnedHubs(
      focusedValue,
      interaction.user.id,
      this.hubService,
    );

    await interaction.respond(
      hubChoices.map((hub) => ({ name: hub.data.name, value: hub.data.name })),
    );
  }

  @RegisterInteractionHandler('hub_delete')
  async handleComponents(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [userId, hubId] = customId.args;

    const locale = await fetchUserLocale(interaction.user.id);

    if (interaction.user.id !== userId) {
      const infoEmbed = new InfoEmbed().setDescription(
        t('hub.delete.ownerOnly', locale, {
          emoji: getEmoji('x_icon', interaction.client),
        }),
      );

      await interaction.reply({ embeds: [infoEmbed], flags: ['Ephemeral'] });
      return;
    }

    if (customId.suffix === 'cancel') {
      const infoEmbed = new InfoEmbed().setDescription(
        t('hub.delete.cancelled', locale, {
          emoji: getEmoji('x_icon', interaction.client),
        }),
      );

      await interaction.update({ embeds: [infoEmbed], components: [] });
      return;
    }

    const embed = new InfoEmbed().setDescription(
      t('global.loading', locale, {
        emoji: getEmoji('loading', interaction.client),
      }),
    );

    await interaction.update({ embeds: [embed], components: [] });

    const hubService = new HubService(db);
    const hubInDb = await hubService.fetchHub(hubId);

    // only the owner can delete the hub
    if (!hubInDb?.isOwner(interaction.user.id)) {
      const infoEmbed = new InfoEmbed().setDescription(
        t('hub.notFound', locale, {
          emoji: getEmoji('x_icon', interaction.client),
        }),
      );

      await interaction.editReply({ embeds: [infoEmbed] });
      return;
    }

    // Delete the hub and all related data
    await hubService.deleteHub(hubInDb.id);

    await interaction.editReply({
      content: t('hub.delete.success', locale, {
        emoji: getEmoji('tick', interaction.client),
        hub: hubInDb.data.name,
      }),
      embeds: [],
    });
  }
}
