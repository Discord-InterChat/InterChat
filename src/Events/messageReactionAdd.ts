import { MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import { getDb } from '../Utils/utils';
import updateMessageReactions from '../Scripts/reactions/updateMessage';
import { HubSettingsBitField } from '../Utils/hubSettingsBitfield';
import { fetchServerBlacklist, fetchUserBlacklist } from '../Utils/blacklist';

export default {
  name: 'messageReactionAdd',
  async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot || user.system) return;

    const db = getDb();
    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: reaction.message.id } } },
      include: { hub: { select: { settings: true } } },
    });

    if (
      !messageInDb?.hub ||
      !messageInDb?.hubId ||
      !new HubSettingsBitField(messageInDb.hub?.settings).has('Reactions') ||
      !reaction.message.inGuild()
    ) return;

    const userBlacklisted = await fetchUserBlacklist(messageInDb.hubId, user.id);
    const serverBlacklisted = await fetchServerBlacklist(messageInDb.hubId, reaction.message.guild.id);
    if (userBlacklisted || serverBlacklisted) return;

    const cooldown = reaction.client.reactionCooldowns.get(user.id);
    if (cooldown && cooldown > Date.now()) return;
    reaction.client.reactionCooldowns.set(user.id, Date.now() + 5000);

    const connections = await db.connectedList.findMany({
      where: {
        channelId: { in: messageInDb?.channelAndMessageIds.map((c) => c.channelId) },
        connected: true,
      },
    });

    const reactedEmoji = reaction.emoji.toString();
    const reactions = messageInDb.reactions?.valueOf() as Record<string, string[]>; // eg. { '👍': 1, '👎': 2 }

    if (
      (!reactions[reactedEmoji] && Object.keys(reactions).length >= 10) ||
      reactions[reactedEmoji]?.includes(user.id)
    ) return;

    reactions[reactedEmoji]
      ? reactions[reactedEmoji].push(user.id)
      : (reactions[reactedEmoji] = [user.id]);


    await db.messageData.update({
      where: { id: messageInDb.id },
      data: { reactions: reactions },
    });

    reaction.users.remove(user.id).catch(() => null);
    updateMessageReactions.execute(connections, messageInDb.channelAndMessageIds, reactions);
  },
};
