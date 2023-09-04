import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageReaction, PartialMessageReaction, WebhookClient } from 'discord.js';
import { getDb } from '../Utils/functions/utils';

export default {
  name: 'messageReactionAdd',
  async execute(reaction: MessageReaction| PartialMessageReaction) { // user: User | PartialUser
    const db = getDb();
    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: reaction.message.id } } },
    });

    if (messageInDb) {
      const connections = await db.connectedList.findMany({
        where: {
          channelId: { in: messageInDb?.channelAndMessageIds.map((c) => c.channelId) },
          connected: true,
        },
      });

      const reactions = JSON.parse(JSON.stringify(messageInDb.reactions));
      const reactionCount = reactions[reaction.emoji.toString()] || 0;
      const otherReactions = Object.entries(reactions).filter((e) => e[0] !== reaction.emoji.toString());
      const reactionBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`reaction_${reaction.emoji.identifier}`)
          .setEmoji(reaction.emoji.toString())
          .setStyle(ButtonStyle.Secondary)
          .setLabel(`${reactionCount + 1}`),
      );

      // use select menu instead (selects feature in roadmap)
      // if (otherReactions) {
      //   reactionBtn.addComponents(
      //     new ButtonBuilder()
      //       .setCustomId('view_all_reactions')
      //       .setStyle(ButtonStyle.Secondary)
      //       .setLabel(`+${otherReactions.length}`),
      //   );
      // }

      connections.forEach(async (connection) => {
        const dbMsg = messageInDb.channelAndMessageIds.find(e => e.channelId === connection.channelId);
        if (!dbMsg) return;

        const webhook = new WebhookClient({ url: connection.webhookURL });
        const message = await webhook.fetchMessage(dbMsg.messageId, { threadId: connection.parentId ? connection.channelId : undefined });
        let components = message.components;

        if (otherReactions) {
          components = components?.filter((c) =>
            c.components.find(e =>
              (e.type === ComponentType.Button &&
               e.style === ButtonStyle.Secondary &&
               e.custom_id.startsWith('reaction_')
              ) === false,
            ),
          );
        }

        components?.push(reactionBtn.toJSON());

        webhook.editMessage(dbMsg.messageId, { components });
      });

      reactions[reaction.emoji.toString()] = reactionCount + 1;
      await db.messageData.update({
        where: { id: messageInDb.id },
        data: { reactions },
      });
    }
  },
};