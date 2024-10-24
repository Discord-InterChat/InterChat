import { emojis } from '#main/config/Constants.js';
import { getBroadcasts, getOriginalMessage } from '#main/utils/network/messageUtils.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import { deleteMessageFromHub, isDeleteInProgress } from '#utils/moderation/deleteMessage.js';
import modActionsPanel from '#utils/moderation/modActions/modActionsPanel.js';
import { type ModAction, replyWithUnknownMessage } from '#utils/moderation/modActions/utils.js';
import { type ButtonInteraction, type Snowflake } from 'discord.js';

export default class DeleteMessageHandler implements ModAction {
  async handle(
    interaction: ButtonInteraction,
    originalMsgId: Snowflake,
    locale: supportedLocaleCodes,
  ) {
    const originalMsg = await getOriginalMessage(originalMsgId);

    if (!originalMsg) {
      await replyWithUnknownMessage(interaction, locale);
      return;
    }

    const deleteInProgress = await isDeleteInProgress(originalMsg.messageId);
    if (deleteInProgress) {
      const { embed, buttons } = await modActionsPanel.buildMessage(interaction, originalMsg);
      await interaction.update({ embeds: [embed], components: buttons });

      const errorEmbed = new InfoEmbed().setDescription(
        `${emojis.neutral} This message is already deleted or is being deleted by another moderator.`,
      );

      await interaction.followUp({ ephemeral: true, embeds: [errorEmbed] });
      return;
    }

    await interaction.reply({
      content: `${emojis.loading} Deleting messages... This may take a minute or so.`,
      ephemeral: true,
    });

    const broadcastMsgs = Object.values(
      await getBroadcasts(originalMsg.messageId, originalMsg.hubId),
    );

    const { deletedCount } = await deleteMessageFromHub(
      originalMsg.hubId,
      originalMsg.messageId,
      broadcastMsgs,
    );

    await interaction
      .editReply(
        t(
          'network.deleteSuccess',
          await interaction.client.userManager.getUserLocale(interaction.user.id),
          {
            emoji: emojis.yes,
            user: `<@${originalMsg.authorId}>`,
            deleted: `${deletedCount}`,
            total: `${broadcastMsgs.length}`,
          },
        ),
      )
      .catch(() => null);
  }
}
