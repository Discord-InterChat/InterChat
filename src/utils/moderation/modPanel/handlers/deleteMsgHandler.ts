import { buildModPanel } from '#main/interactions/ModPanel.js';
import { HubService } from '#main/services/HubService.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';
import { logMsgDelete } from '#main/utils/hub/logger/ModLogs.js';
import { type ModAction, replyWithUnknownMessage } from '#main/utils/moderation/modPanel/utils.js';
import { getBroadcasts, getOriginalMessage } from '#main/utils/network/messageUtils.js';

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
        `${getEmoji('neutral', interaction.client)} This message is already deleted or is being deleted by another moderator.`,
      );

      await interaction.followUp({ ephemeral: true, embeds: [errorEmbed] });
      return;
    }

    await interaction.reply({
      content: `${getEmoji('loading', interaction.client)} Deleting messages... This may take a minute or so.`,
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
            emoji: getEmoji('tick_icon', interaction.client),
            user: `<@${originalMsg.authorId}>`,
            deleted: `${deletedCount}`,
            total: `${broadcastMsgs.length}`,
          },
        ),
      )
      .catch(() => null);

    const hub = await new HubService().fetchHub(originalMsg.hubId);
    if (!hub) return;

    await logMsgDelete(interaction.client, originalMsg, await hub.fetchLogConfig(), {
      hubName: hub.data.name,
      modName: interaction.user.username,
    });
  }
}
