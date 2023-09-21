import { MessageDataChannelAndMessageIds, connectedList } from '@prisma/client';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, WebhookClient, ComponentType } from 'discord.js';
import sortReactions from './sortReactions';

export default {
  execute(
    connections: connectedList[],
    channelAndMessageIds: MessageDataChannelAndMessageIds[],
    reactions: Record<string, string[]>,
  ) {
  // reactions will contain something like this: { '👍': 1, '👎': 2 }
  // sortedReactions[0] = array of [emoji, users[]]
  // sortedReactions[0][0] = emoji
  // sortedReactions[0][1] = array of users
    const sortedReactions = sortReactions.execute(reactions);
    const reactionCount = sortedReactions[0][1].length;
    const mostReaction = sortedReactions[0][0];

    const reactionBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`reaction_${mostReaction}`)
        .setEmoji(mostReaction)
        .setStyle(ButtonStyle.Secondary)
        .setLabel(`${reactionCount}`),
    );

    if (sortedReactions.length > 1) {
      const allReactionCount = sortedReactions.filter((e) => e[0] !== mostReaction && e[1].length > 0);
      if (allReactionCount.length > 0) {
        reactionBtn.addComponents(
          new ButtonBuilder()
            .setCustomId('view_all_reactions')
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`+ ${allReactionCount.length}`),
        );
      }

    }

    connections.forEach(async (connection) => {
      const dbMsg = channelAndMessageIds.find((e) => e.channelId === connection.channelId);
      if (!dbMsg) return;

      const webhook = new WebhookClient({ url: connection.webhookURL });
      const message = await webhook.fetchMessage(dbMsg.messageId, {
        threadId: connection.parentId ? connection.channelId : undefined,
      });

      // remove all reaction buttons from components
      // customId should not start with 'reaction_' or 'view_all_reactions'
      const components = message.components?.filter((row) => {
        const filteredRow = row.components.filter((component) => {
          if (component.type === ComponentType.Button && component.style === ButtonStyle.Secondary) {
            return !component.custom_id.startsWith('reaction_') && component.custom_id !== 'view_all_reactions';
          }
          return true;
        });

        row.components = filteredRow;
        return filteredRow.length > 0;
      });

      reactionCount > 0 ? components?.push(reactionBtn.toJSON()) : null;
      webhook.editMessage(dbMsg.messageId, {
        components,
        threadId: connection.parentId ? connection.channelId : undefined,
      });
    });
  },
};