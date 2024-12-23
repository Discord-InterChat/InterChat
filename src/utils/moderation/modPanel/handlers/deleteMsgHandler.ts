import { buildModPanel } from '#main/interactions/ModPanel.js';
import { type ModAction, replyWithUnknownMessage } from '#main/utils/moderation/modPanel/utils.js';
import { getBroadcasts, getOriginalMessage } from '#main/utils/network/messageUtils.js';
import { emojis } from '#utils/Constants.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import { type supportedLocaleCodes, t } from '#utils/Locale.js';
import { deleteMessageFromHub, isDeleteInProgress } from '#utils/moderation/deleteMessage.js';
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
      const { embed, buttons } = await buildModPanel(interaction, originalMsg);
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

    // log the deletion to the hub's mod log channel
    // FIXME: store message content for easier access
    // if (interaction.message.reference?.messageId) {
    //   const hub = await fetchHub(originalMsg.hubId);
    //   const msgContent = originalMsg.content;
    //   await logMsgDelete(
    //     interaction.client,
    //     interaction.message.reference?.messageId,
    //     await fetchHub(originalMsg.hubId),
    //     {
    //       modName: interaction.user.id,
    //       serverId: originalMsg.guildId,
    //       userId: originalMsg.authorId,
    //       imageUrl,
    //     },
    //   );
    // }

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
