/*
 * Copyright (C) 2025 InterChat
 *
 * InterChat is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * InterChat is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with InterChat.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { ButtonInteraction, Snowflake } from 'discord.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import { type ModAction, replyWithUnknownMessage } from '#src/utils/moderation/modPanel/utils.js';
import { getOriginalMessage } from '#src/utils/network/messageUtils.js';
import type { ReactionArray } from '#types/Utils.d.ts';
import { updateReactions } from '#utils/reaction/actions.js';
import sortReactions from '#utils/reaction/sortReactions.js';

export default class RemoveReactionsHandler implements ModAction {
  async handle(interaction: ButtonInteraction, originalMsgId: Snowflake): Promise<void> {
    await interaction.deferReply({ flags: ['Ephemeral'] });

    const originalMsg = await getOriginalMessage(originalMsgId);
    if (!originalMsg) {
      await replyWithUnknownMessage(interaction, 'en');
      return;
    }

    if (!sortReactions((originalMsg.reactions as ReactionArray) ?? {}).length) {
      await interaction.followUp({
        content: `${getEmoji('slash', interaction.client)} No reactions to remove.`,
        flags: ['Ephemeral'],
      });
      return;
    }

    await updateReactions(originalMsg, {});

    await interaction.followUp({
      content: `${getEmoji('tick_icon', interaction.client)} Reactions removed.`,
      flags: ['Ephemeral'],
    });
  }
}
