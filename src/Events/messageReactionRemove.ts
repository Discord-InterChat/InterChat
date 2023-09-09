import { MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import { getDb } from '../Utils/functions/utils';
import updateMessageReactions from '../Scripts/reactions/updateMessage';

export default {
  name: 'messageReactionRemove',
  async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot || user.system) return;

    const db = getDb();
    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: reaction.message.id } } },
    });

    if (!messageInDb) return;
    const cooldown = reaction.client.reactionCooldowns.get(user.id);
    if (cooldown && cooldown > Date.now()) return;
    reaction.client.reactionCooldowns.set(user.id, Date.now() + 3000);

    const connections = await db.connectedList.findMany({
      where: {
        channelId: { in: messageInDb?.channelAndMessageIds.map((c) => c.channelId) },
        connected: true,
      },
    });

    const reactedEmoji = reaction.emoji.toString();
    const reactions = messageInDb.reactions?.valueOf() as Record<string, string[]>; // eg. { '👍': ['userId1'], '👎': ['userId1'] }

    // Remove the user from the array
    if (reactions[reactedEmoji]) {
      const userIndex = reactions[reactedEmoji].indexOf(user.id);
      reactions[reactedEmoji].splice(userIndex, 1);
    }

    await db.messageData.update({
      where: { id: messageInDb.id },
      data: { reactions: reactions },
    });

    updateMessageReactions(connections, messageInDb.channelAndMessageIds, reactions);
  },
};
