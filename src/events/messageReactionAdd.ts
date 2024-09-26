import BaseEventListener from '#main/core/BaseEventListener.js';
import { addReaction, updateReactions } from '#main/utils/reaction/actions.js';
import { checkBlacklists } from '#main/utils/reaction/helpers.js';
import { HubSettingsBitField } from '#main/modules/BitFields.js';
import db from '#main/utils/Db.js';
import Logger from '#main/utils/Logger.js';
import { MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';

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

    const originalMsg = (
      await db.broadcastedMessages.findFirst({
        where: { messageId: reaction.message.id },
        include: { originalMsg: { include: { hub: true, broadcastMsgs: true } } },
      })
    )?.originalMsg;

    if (!originalMsg?.hub || !new HubSettingsBitField(originalMsg.hub.settings).has('Reactions')) {
      return;
    }

    Logger.info(
      `${reaction.emoji.name} reacted by ${user.tag} guild ${reaction.message.guild?.name} (${reaction.message.guildId}). Hub: ${originalMsg.hub.name}`,
    );

    const { userBlacklisted, serverBlacklisted } = await checkBlacklists(
      originalMsg.hub.id,
      reaction.message.guildId,
      user.id,
    );

    if (userBlacklisted || serverBlacklisted) return;

    const reactedEmoji = reaction.emoji.toString();
    const dbReactions = (originalMsg.reactions?.valueOf() ?? {}) as { [key: string]: string[] }; // eg. { '👍': 1, '👎': 2 }
    const emojiAlreadyReacted = dbReactions[reactedEmoji] ?? [user.id];

    // max 10 reactions
    if (Object.keys(dbReactions).length >= 10) return;

    // if there already are reactions by others and the user hasn't reacted yet
    if (!emojiAlreadyReacted?.includes(user.id)) addReaction(dbReactions, user.id, reactedEmoji);
    // update the data with a new arr containing userId
    else dbReactions[reactedEmoji] = emojiAlreadyReacted;

    await db.originalMessages.update({
      where: { messageId: originalMsg.messageId },
      data: { reactions: dbReactions },
    });

    reaction.users.remove(user.id).catch(() => null);
    await updateReactions(originalMsg.broadcastMsgs, dbReactions);
  }
}
