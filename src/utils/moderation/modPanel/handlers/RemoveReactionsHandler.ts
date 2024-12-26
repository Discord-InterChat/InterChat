import type { ReactionArray } from '#types/Utils.d.ts';
import { getOriginalMessage } from '#main/utils/network/messageUtils.js';
import { ModAction, replyWithUnknownMessage } from '#main/utils/moderation/modPanel/utils.js';
import { updateReactions } from '#utils/reaction/actions.js';
import sortReactions from '#utils/reaction/sortReactions.js';
import { ButtonInteraction, Snowflake } from 'discord.js';
import { getEmoji } from '#main/utils/EmojiUtils.js';

export default class RemoveReactionsHandler implements ModAction {
  async handle(interaction: ButtonInteraction, originalMsgId: Snowflake): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const originalMsg = await getOriginalMessage(originalMsgId);
    if (!originalMsg) {
      await replyWithUnknownMessage(interaction, 'en');
      return;
    }

    if (!sortReactions((originalMsg.reactions as ReactionArray) ?? {}).length) {
      await interaction.followUp({
        content: `${getEmoji('slash', interaction.client)} No reactions to remove.`,
        ephemeral: true,
      });
      return;
    }

    await updateReactions(originalMsg, {});

    await interaction.followUp({
      content: `${getEmoji('tick_icon', interaction.client)} Reactions removed.`,
      ephemeral: true,
    });
  }
}
