import { emojis } from '#main/config/Constants.js';
import { ReactionArray } from '#main/types/network.js';
import { fetchMessageFromDb, ModAction } from '#utils/moderation/modActions/utils.js';
import { updateReactions } from '#utils/reaction/actions.js';
import sortReactions from '#utils/reaction/sortReactions.js';
import { ButtonInteraction, Snowflake } from 'discord.js';

export default class RemoveReactionsHandler implements ModAction {
  async handle(interaction: ButtonInteraction, originalMsgId: Snowflake): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const originalMsg = await fetchMessageFromDb(originalMsgId, {
      broadcastMsgs: true,
    });

    if (
      !originalMsg?.broadcastMsgs?.length ||
      !sortReactions((originalMsg.reactions as ReactionArray) ?? {}).length
    ) {
      await interaction.followUp({
        content: `${emojis.slash} No reactions to remove.`,
        ephemeral: true,
      });
      return;
    }

    await updateReactions(originalMsg?.broadcastMsgs, {});

    await interaction.followUp({
      content: `${emojis.yes} Reactions removed.`,
      ephemeral: true,
    });
  }
}
