import { MessageDataChannelAndMessageIds, connectedList } from '@prisma/client';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, WebhookClient, ComponentType } from 'discord.js';
import sortReactions from './sortReactions';

export default function updateMessageReactions(
  connections: connectedList[],
  channelAndMessageIds: MessageDataChannelAndMessageIds[],
  reactions: Record<string, string[]>,
) {
  // reactions will contain something like this: { '👍': 1, '👎': 2 }
  const sortedReactions = sortReactions(reactions);
  const reactionCount = sortedReactions[0][1].length;
  const mostReaction = sortedReactions[0][0];

  console.log(sortedReactions);

  const reactionBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`reaction_${mostReaction}`)
      .setEmoji(mostReaction)
      .setStyle(ButtonStyle.Secondary)
      .setLabel(`${reactionCount}`),
  );


  connections.forEach(async (connection) => {
    const dbMsg = channelAndMessageIds.find((e) => e.channelId === connection.channelId);
    if (!dbMsg) return;

    const webhook = new WebhookClient({ url: connection.webhookURL });
    const message = await webhook.fetchMessage(dbMsg.messageId, {
      threadId: connection.parentId ? connection.channelId : undefined,
    });
    let components = message.components;

    components = components?.filter((c) =>
      c.components.find(
        (e) =>
          (e.type === ComponentType.Button &&
            e.style === ButtonStyle.Secondary &&
            e.custom_id.startsWith('reaction_')) === false,
      ),
    );

    reactionCount > 0 ? components?.push(reactionBtn.toJSON()) : null;
    webhook.editMessage(dbMsg.messageId, { components });
  });
}