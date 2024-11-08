import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { CustomID } from '#main/utils/CustomID.js';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from 'discord.js';

export const markResolvedButton = () =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(new CustomID().setIdentifier('markResolved').toString())
      .setStyle(ButtonStyle.Success)
      .setLabel('Mark as Resolved'),
  );

export default class MarkResolvedButton {
  @RegisterInteractionHandler('markResolved')
  async handler(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const { components } = interaction.message;
    if (!components) return;

    const rows = components.map((row) => new ActionRowBuilder(row));

    rows.forEach((row) => {
      row.components.forEach((component) => {
        if (
          component instanceof ButtonBuilder &&
          component.data.style === ButtonStyle.Success &&
          component.data.custom_id === interaction.customId
        ) {
          component.setDisabled(true);
        }
      });
    });

    await interaction.editReply({ components });
  }
}
