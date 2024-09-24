import { emojis } from '#main/config/Constants.js';
import { type supportedLocaleCodes, t } from '#main/utils/Locale.js';
import { isDeleteInProgress, deleteMessageFromHub } from '#main/utils/moderation/deleteMessage.js';
import modActionsPanel from '#main/utils/moderation/modActions/modActionsPanel.js';
import {
  type ModAction,
  fetchMessageFromDb,
  replyWithUnknownMessage,
} from '#main/utils/moderation/modActions/utils.js';
import { simpleEmbed } from '#main/utils/Utils.js';
import { type ButtonInteraction, type Snowflake } from 'discord.js';

export default class DeleteMessageHandler implements ModAction {
  async handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    const originalMsg = await fetchMessageFromDb(originalMsgId, {
      broadcastMsgs: true,
    });

    if (!originalMsg?.hubId || !originalMsg.broadcastMsgs) {
      await replyWithUnknownMessage(interaction, locale);
      return;
    }

    const deleteInProgress = await isDeleteInProgress(originalMsg.messageId);
    if (deleteInProgress) {
      const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg);
      await interaction.update({ embeds: [embed], components: [buttons] });

      const errorEmbed = simpleEmbed(
        `${emojis.neutral} This message is already deleted or is being deleted by another moderator.`,
      );

      await interaction.followUp({ ephemeral: true, embeds: [errorEmbed] });
      return;
    }

    await interaction.reply({
      content: `${emojis.loading} Deleting messages... This may take a minute or so.`,
      ephemeral: true,
    });

    const { deletedCount } = await deleteMessageFromHub(
      originalMsg.hubId,
      originalMsg.messageId,
      originalMsg.broadcastMsgs,
    );

    await interaction
      .editReply(
        t(
          {
            phrase: 'network.deleteSuccess',
            locale: await interaction.client.userManager.getUserLocale(interaction.user.id),
          },
          {
            emoji: emojis.yes,
            user: `<@${originalMsg.authorId}>`,
            deleted: `${deletedCount}`,
            total: `${originalMsg.broadcastMsgs.length}`,
          },
        ),
      )
      .catch(() => null);
  }
}
