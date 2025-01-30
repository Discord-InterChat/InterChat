import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import { CustomID } from '#src/utils/CustomID.js';
import { handleError } from '#src/utils/Utils.js';

export const markResolvedButton = () =>
  new ButtonBuilder()
    .setCustomId(new CustomID().setIdentifier('markResolved').toString())
    .setStyle(ButtonStyle.Success)
    .setLabel('Mark Resolved');

export default class MarkResolvedButton {
  @RegisterInteractionHandler('markResolved')
  async handler(interaction: ButtonInteraction): Promise<void> {
    try {
      await interaction.deferUpdate();
      const components = interaction.message.components;
      if (!components) return;

      const rows = components.map((row) =>
        ActionRowBuilder.from(row),
      ) as ActionRowBuilder<MessageActionRowComponentBuilder>[];

      for (const row of rows) {
        for (const component of row.components) {
          if (
            component instanceof ButtonBuilder &&
            component.data.style === ButtonStyle.Success &&
            component.data.custom_id === interaction.customId
          ) {
            component.setLabel(`Resolved by @${interaction.user.username}`);
            component.setDisabled(true);
          }
        }
      }

      await interaction.editReply({ components: rows });
    }
    catch (e) {
      handleError(e, { repliable: interaction, comment: 'Failed to mark the message as resolved' });
    }
  }
}
