import { emojis } from '#main/config/Constants.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { CustomID } from '#main/utils/CustomID.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { fetchHub, isStaffOrHubMod } from '#main/utils/hub/utils.js';
import modActionsPanel from '#main/utils/moderation/modActions/modActionsPanel.js';
import { findOriginalMessage, getOriginalMessage } from '#main/utils/network/messageUtils.js';
import { ButtonInteraction } from 'discord.js';

export default class ModActionsButton {
  @RegisterInteractionHandler('showModPanel')
  async handler(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const customId = CustomID.parseCustomId(interaction.customId);
    const [messageId] = customId.args;

    const originalMessage =
      (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId));
    const hub = originalMessage ? await fetchHub(originalMessage?.hubId) : null;

    if (!originalMessage || !hub || !isStaffOrHubMod(interaction.user.id, hub)) {
      await interaction.editReply({ components: [] });
      await interaction.followUp({
        embeds: [new InfoEmbed({ description: `${emojis.slash} Message was deleted.` })],
        ephemeral: true,
      });
      return;
    }

    if (!isStaffOrHubMod(interaction.user.id, hub)) return;

    const panel = await modActionsPanel.buildMessage(interaction, originalMessage);
    await interaction.followUp({
      embeds: [panel.embed],
      components: panel.buttons,
      ephemeral: true,
    });
  }
}
