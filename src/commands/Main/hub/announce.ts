import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import { HubService } from '#src/services/HubService.js';
import { CustomID } from '#src/utils/CustomID.js';
import db from '#src/utils/Db.js';
import { sendToHub } from '#src/utils/hub/utils.js';

import {
  ActionRowBuilder,
  type AutocompleteInteraction,
  EmbedBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import type Context from '#src/core/CommandContext/Context.js';
import BaseCommand from '#src/core/BaseCommand.js';
import HubCommand, { hubOption } from '#src/commands/Main/hub/index.js';
import { escapeRegexChars } from '#src/utils/Utils.js';

export default class AnnounceCommand extends BaseCommand {
  private readonly hubService = new HubService();
  readonly cooldown = 1 * 60 * 1000;

  constructor() {
    super({
      name: 'announce',
      description: '📢 Send an announcement to a hub you moderate.',
      types: { slash: true, prefix: true },
      options: [hubOption],
    });
  }
  async execute(ctx: Context) {
    const hubName = ctx.options.getString('hub');
    if (!hubName) {
      await ctx.replyEmbed('hub.notFound_mod', {
        flags: ['Ephemeral'],
        t: { emoji: ctx.getEmoji('x_icon') },
      });
      return;
    }

    const hub = (await this.hubService.findHubsByName(hubName)).at(0);

    if (!hub || !(await hub.isMod(ctx.user.id))) {
      await ctx.replyEmbed('hub.notFound_mod', {
        flags: ['Ephemeral'],
        t: { emoji: ctx.getEmoji('x_icon') },
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(new CustomID('hub_announce', [hub.id]).toString())
      .setTitle('Announce something to all connected servers')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('announcement')
            .setLabel('Announcement')
            .setPlaceholder('Enter your announcement here')
            .setRequired(true)
            .setMinLength(5)
            .setStyle(TextInputStyle.Paragraph),
        ),
      );

    await ctx.showModal(modal);
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = escapeRegexChars(interaction.options.getFocused());
    const hubChoices = await HubCommand.getModeratedHubs(
      focusedValue,
      interaction.user.id,
      this.hubService,
    );

    await interaction.respond(
      hubChoices.map((hub) => ({
        name: hub.data.name,
        value: hub.data.name,
      })),
    );
  }

  @RegisterInteractionHandler('hub_announce')
  async handleAnnounceModal(interaction: ModalSubmitInteraction) {
    await interaction.reply(
      `${getEmoji('loading', interaction.client)} Sending announcement to all connected servers...`,
    );
    const [hubId] = CustomID.parseCustomId(interaction.customId).args;
    const announcement = interaction.fields.getTextInputValue('announcement');
    const hubService = new HubService(db);
    const hub = await hubService.fetchHub(hubId);

    if (!hub) {
      await interaction.editReply(`${getEmoji('x_icon', interaction.client)} Hub not found.`);
      return;
    }

    await sendToHub(hubId, {
      username: hub.data.name ?? 'InterChat Hub Announcement',
      avatarURL: hub.data.iconUrl,
      embeds: [
        new EmbedBuilder()
          .setTitle('📢 Official Hub Announcement')
          .setDescription(announcement)
          .setColor('#3b82f6')
          .setTimestamp(),
      ],
    });

    await interaction.editReply(
      `${getEmoji('tick_icon', interaction.client)} Announcement sent to all connected servers.`,
    );
  }
}
