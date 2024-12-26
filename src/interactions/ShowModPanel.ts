import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { CustomID } from '#main/utils/CustomID.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { isStaffOrHubMod } from '#main/utils/hub/utils.js';
import { findOriginalMessage, getOriginalMessage } from '#main/utils/network/messageUtils.js';
import { ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js';
import { buildModPanel } from '#main/interactions/ModPanel.js';
import { HubService } from '#main/services/HubService.js';
import db from '#main/utils/Db.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';

export const modPanelButton = (targetMsgId: string, emoji: string, opts?: { label?: string }) =>
  new ButtonBuilder()
    .setCustomId(new CustomID().setIdentifier('showModPanel').setArgs(targetMsgId).toString())
    .setStyle(ButtonStyle.Danger)
    .setLabel(opts?.label ?? 'Mod Panel')
    .setEmoji(emoji);

export default class ModActionsButton {
  @RegisterInteractionHandler('showModPanel')
  async handler(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const customId = CustomID.parseCustomId(interaction.customId);
    const [messageId] = customId.args;

    const originalMessage =
      (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId));

    const hubService = new HubService(db);
    const hub = originalMessage ? await hubService.fetchHub(originalMessage?.hubId) : null;

    if (!originalMessage || !hub || !await isStaffOrHubMod(interaction.user.id, hub)) {
      await interaction.editReply({ components: [] });
      await interaction.followUp({
        embeds: [new InfoEmbed({ description: `${getEmoji('slash', interaction.client)} Message was deleted.` })],
        ephemeral: true,
      });
      return;
    }

    if (!await isStaffOrHubMod(interaction.user.id, hub)) return;

    const panel = await buildModPanel(interaction, originalMessage);
    await interaction.followUp({
      embeds: [panel.embed],
      components: panel.buttons,
      ephemeral: true,
    });
  }
}
