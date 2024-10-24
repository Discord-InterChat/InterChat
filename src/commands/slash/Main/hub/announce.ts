import { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { isHubManager, sendToHub } from '#main/utils/hub/utils.js';
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import HubCommand from './index.js';
import { CustomID } from '#main/utils/CustomID.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';

export default class AnnounceCommand extends HubCommand {
  readonly cooldown = 1 * 60 * 1000;
  async execute(interaction: ChatInputCommandInteraction) {
    const hubName = interaction.options.getString('hub', true);
    const hub = await db.hub.findFirst({ where: { name: hubName } });

    if (!hub || !isHubManager(interaction.user.id, hub)) {
      await this.replyEmbed(interaction, 'hub.notFound_mod', { ephemeral: true });
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

    await sendToHub(hubId, {
      embeds: [
        new InfoEmbed()
          .setTitle('📢 Official Hub Announcement')
          .setDescription(announcement)
          .setTimestamp(),
      ],
    });

    await interaction.editReply(`${emojis.yes} Announcement sent to all connected servers.`);
  }
}
