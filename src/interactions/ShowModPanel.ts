import { ButtonBuilder, type ButtonInteraction, ButtonStyle } from 'discord.js';
import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import { buildModPanel } from '#src/interactions/ModPanel.js';
import { HubService } from '#src/services/HubService.js';
import { CustomID } from '#src/utils/CustomID.js';
import db from '#src/utils/Db.js';
import { InfoEmbed } from '#src/utils/EmbedUtils.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import { isStaffOrHubMod } from '#src/utils/hub/utils.js';
import { findOriginalMessage, getOriginalMessage } from '#src/utils/network/messageUtils.js';

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

    if (!originalMessage || !hub || !(await isStaffOrHubMod(interaction.user.id, hub))) {
      await interaction.editReply({ components: [] });
      await interaction.followUp({
        embeds: [
          new InfoEmbed({
            description: `${getEmoji('slash', interaction.client)} Message was deleted.`,
          }),
        ],
        flags: ['Ephemeral'],
      });
      return;
    }

    if (!(await isStaffOrHubMod(interaction.user.id, hub))) return;

    const panel = await buildModPanel(interaction, originalMessage);
    await interaction.followUp({
      embeds: [panel.embed],
      components: panel.buttons,
      flags: ['Ephemeral'],
    });
  }
}
