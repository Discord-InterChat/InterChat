import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { HubService } from '#main/services/HubService.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { sendToHub } from '#main/utils/hub/utils.js';

import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import HubCommand from './index.js';

export default class AnnounceCommand extends HubCommand {
  readonly cooldown = 1 * 60 * 1000;
  async execute(interaction: ChatInputCommandInteraction) {
    const hubName = interaction.options.getString('hub', true);

    const hubService = new HubService();
    const hub = (await hubService.findHubsByName(hubName)).at(0);

    if (!hub || !(await hub.isMod(interaction.user.id))) {
      await this.replyEmbed(interaction, 'hub.notFound_mod', {
        flags: 'Ephemeral',
        t: { emoji: this.getEmoji('x_icon') },
      });
      return;
    }

    const isOnCooldown = await this.checkOrSetCooldown(interaction);
    if (isOnCooldown) return;

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

    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('hub_announce')
  async handleAnnounceModal(interaction: ModalSubmitInteraction) {
    await interaction.reply(
      `${this.getEmoji('loading')} Sending announcement to all connected servers...`,
    );
    const [hubId] = CustomID.parseCustomId(interaction.customId).args;
    const announcement = interaction.fields.getTextInputValue('announcement');
    const hubService = new HubService(db);
    const hub = await hubService.fetchHub(hubId);

    if (!hub) {
      await interaction.editReply(`${this.getEmoji('x_icon')} Hub not found.`);
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
      `${this.getEmoji('tick_icon')} Announcement sent to all connected servers.`,
    );
  }
}
