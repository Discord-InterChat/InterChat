import { emojis } from '#utils/Constants.js';
import db from '#main/utils/Db.js';
import { isHubManager, sendToHub } from '#main/utils/hub/utils.js';
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import HubCommand from './index.js';
import { CustomID } from '#main/utils/CustomID.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { HubService } from '#main/services/HubService.js';

export default class AnnounceCommand extends HubCommand {
  readonly cooldown = 1 * 60 * 1000;
  async execute(interaction: ChatInputCommandInteraction) {
    const hubName = interaction.options.getString('hub', true);
    const hub = await db.hub.findFirst({ where: { name: hubName } });

    if (!hub || !isHubManager(interaction.user.id, hub)) {
      await this.replyEmbed(interaction, 'hub.notFound_mod', { ephemeral: true, t: { emoji: emojis.no } });
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
    await interaction.reply(`${emojis.loading} Sending announcement to all connected servers...`);
    const [hubId] = CustomID.parseCustomId(interaction.customId).args;
    const announcement = interaction.fields.getTextInputValue('announcement');
    const hubService = new HubService(db);
    const hub = await hubService.fetchHub(hubId);

    await sendToHub(hubId, {
      avatarURL: hub?.iconUrl,
      embeds: [
        new EmbedBuilder()
          .setTitle('📢 Official Hub Announcement')
          .setDescription(announcement)
          .setColor('#3b82f6')
          .setTimestamp(),
      ],
    });

    await interaction.editReply(`${emojis.yes} Announcement sent to all connected servers.`);
  }
}
