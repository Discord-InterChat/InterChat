import db from '../utils/Db.js';
import Factory from '../Factory.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
  WebhookClient,
} from 'discord.js';
import {
  connectedList,
  MessageDataChannelAndMessageIds,
} from '@prisma/client';
import { sortReactions } from '../utils/Utils.js';
import { BlacklistManager } from '../structures/BlacklistManager.js';
import { HubSettingsBitField } from '../utils/BitFields.js';

export default class ReactionUpdater extends Factory {
  public async listen(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    if (user.bot || user.system) return;

    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: reaction.message.id } } },
      include: { hub: { select: { settings: true } } },
    });

    if (
      !messageInDb?.hub ||
      !messageInDb.hubId ||
      !new HubSettingsBitField(messageInDb.hub.settings).has('Reactions') ||
      !reaction.message.inGuild()
    ) {
      return;
    }

    const userBlacklisted = await BlacklistManager.fetchUserBlacklist(messageInDb.hubId, user.id);
    const serverBlacklisted = await BlacklistManager.fetchUserBlacklist(
      messageInDb.hubId,
      reaction.message.guild.id,
    );
    if (userBlacklisted || serverBlacklisted) return;

    const connections = await db.connectedList.findMany({
      where: {
        channelId: { in: messageInDb.channelAndMessageIds.map((c) => c.channelId) },
        connected: true,
      },
    });

    const reactedEmoji = reaction.emoji.toString();
    const reactions = messageInDb.reactions?.valueOf() as { [key: string]: string[] }; // eg. { '👍': 1, '👎': 2 }

    if (
      (!reactions[reactedEmoji] && Object.keys(reactions).length >= 10) ||
      reactions[reactedEmoji]?.includes(user.id)
    ) {
      return;
    }

    reactions[reactedEmoji]
      ? reactions[reactedEmoji].push(user.id)
      : (reactions[reactedEmoji] = [user.id]);

    await db.messageData.update({
      where: { id: messageInDb.id },
      data: { reactions: reactions },
    });

    reaction.users.remove(user.id).catch(() => null);
    this.updateReactions(connections, messageInDb.channelAndMessageIds, reactions);
  }

  updateReactions(
    connections: connectedList[],
    channelAndMessageIds: MessageDataChannelAndMessageIds[],
    reactions: { [key: string]: string[] },
  ): void {
    // reactions data example: { '👍': ['userId1', 'userId2'], '👎': ['userId1', 'userId2', 'userId3'] }
    // sortedReactions[0] = array of [emoji, users[]]
    // sortedReactions[x] = emojiIds
    // sortedReactions[x][y] = arr of users
    const sortedReactions = sortReactions(reactions);
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
      const allReactionCount = sortedReactions.filter(
        (e) => e[0] !== mostReaction && e[1].length > 0,
      );
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
      const message = await webhook
        .fetchMessage(dbMsg.messageId, {
          threadId: connection.parentId ? connection.channelId : undefined,
        })
        .catch(() => null);

      const components = message?.components?.filter((row) => {
        // filter all buttons that are not reaction buttons
        row.components = row.components.filter((component) => {
          return component.type === ComponentType.Button &&
            component.style === ButtonStyle.Secondary
            ? !component.custom_id.startsWith('reaction_') &&
                component.custom_id !== 'view_all_reactions'
            : true;
        });

        // if the filtered row  has components, that means it has components other than reaction buttons
        // so we return true to keep the row
        return row.components.length > 0;
      });

      if (reactionCount > 0) components?.push(reactionBtn.toJSON());

      webhook
        .editMessage(dbMsg.messageId, {
          components,
          threadId: connection.parentId ? connection.channelId : undefined,
        })
        .catch(() => null);
    });
  }
}
