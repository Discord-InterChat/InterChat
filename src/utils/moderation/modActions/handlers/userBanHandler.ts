import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import handleBan from '#main/utils/banUtls/handleBan.js';
import { CustomID } from '#main/utils/CustomID.js';
import type { supportedLocaleCodes } from '#main/utils/Locale.js';
import {
  type ModAction,
  fetchMessageFromDb,
  replyWithUnknownMessage,
} from '#main/utils/moderation/modActions/utils.js';
import {
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Snowflake,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

export default class UserBanHandler implements ModAction {
  async handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    const originalMsg = await fetchMessageFromDb(originalMsgId);

    if (!originalMsg) {
      await replyWithUnknownMessage(interaction, locale);
      return;
    }

    const modal = new ModalBuilder()
      .setTitle('Ban User')
      .setCustomId(
        new CustomID().setIdentifier('userBanModal').addArgs(originalMsg.authorId).toString(),
      )
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('reason')
            .setPlaceholder('Breaking rules...')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500),
        ),
      );

    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('userBanModal')
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [userId] = customId.args;

    const user = await interaction.client.users.fetch(userId).catch(() => null);
    const reason = interaction.fields.getTextInputValue('reason');

    await handleBan(interaction, userId, user, reason);
  }
}
