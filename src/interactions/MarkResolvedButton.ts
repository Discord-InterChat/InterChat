import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { CustomID } from '#main/utils/CustomID.js';
import { handleError } from '#main/utils/Utils.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageActionRowComponentBuilder,
} from 'discord.js';

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

      const rows = components.map(
        (row) => ActionRowBuilder.from(row),
      ) as ActionRowBuilder<MessageActionRowComponentBuilder>[];

      rows.forEach((row) => {
        row.components.forEach((component) => {
          if (
            component instanceof ButtonBuilder &&
            component.data.style === ButtonStyle.Success &&
            component.data.custom_id === interaction.customId
          ) {
            component.setLabel(`Resolved by @${interaction.user.username}`);
            component.setDisabled(true);
          }
        });
      });

      await interaction.editReply({ components: rows });
    }
    catch (e) {
      e.message = `Failed to mark the message as resolved: ${e.message}`;
      handleError(e, interaction);
    }
  }
}
