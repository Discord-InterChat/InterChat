import type { MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import BaseEventListener from '#src/core/BaseEventListener.js';
import { HubService } from '#src/services/HubService.js';
import db from '#src/utils/Db.js';
import {
  findOriginalMessage,
  getOriginalMessage,
  storeMessage,
} from '#src/utils/network/messageUtils.js';
import { addReaction, updateReactions } from '#utils/reaction/actions.js';
import { checkBlacklists } from '#utils/reaction/helpers.js';

export default class ReadctionAdd extends BaseEventListener<'messageReactionAdd'> {
  readonly name = 'messageReactionAdd';
  public async execute(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ) {
    if (user.bot || !reaction.message.inGuild()) return;

    const cooldown = reaction.client.reactionCooldowns.get(user.id);
    if (cooldown && cooldown > Date.now()) return;

    // add user to cooldown list
    user.client.reactionCooldowns.set(user.id, Date.now() + 3000);

    const originalMsg =
      (await getOriginalMessage(reaction.message.id)) ??
      (await findOriginalMessage(reaction.message.id));

    const hubService = new HubService(db);
    const hub = originalMsg ? await hubService.fetchHub(originalMsg?.hubId) : null;

    if (!originalMsg || !hub?.settings.has('Reactions')) {
      return;
    }

    const { userBlacklisted, serverBlacklisted } = await checkBlacklists(
      hub.id,
      reaction.message.guildId,
      user.id,
    );

    if (userBlacklisted || serverBlacklisted) return;

    const reactedEmoji = reaction.emoji.toString();
    const dbReactions = (originalMsg.reactions?.valueOf() ?? {}) as {
      [key: string]: string[];
    }; // eg. { '👍': 1, '👎': 2 }
    const emojiAlreadyReacted = dbReactions[reactedEmoji] ?? [user.id];

    // max 10 reactions
    if (Object.keys(dbReactions).length >= 10) return;

    // if there already are reactions by others and the user hasn't reacted yet
    if (!emojiAlreadyReacted?.includes(user.id)) {
      addReaction(dbReactions, user.id, reactedEmoji);
    }
    // update the data with a new arr containing userId
    else {
      dbReactions[reactedEmoji] = emojiAlreadyReacted;
    }

    await storeMessage(originalMsg.messageId, {
      ...originalMsg,
      reactions: dbReactions,
    });

    reaction.users.remove(user.id).catch(() => null);
    await updateReactions(originalMsg, dbReactions);
  }
}
