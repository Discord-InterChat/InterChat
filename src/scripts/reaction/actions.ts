import { broadcastedMessages } from '@prisma/client';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  WebhookClient,
  ComponentType,
  Snowflake,
} from 'discord.js';
import { CustomID } from '#main/utils/CustomID.js';
import db from '#main/utils/Db.js';
import { getEmojiId } from '#main/utils/Utils.js';
import sortReactions from './sortReactions.js';

/**
 * Adds a user ID to the array of user IDs for a given emoji in the reactionArr object.
 * @param reactionArr - The object containing arrays of user IDs for each emoji.
 * @param userId - The ID of the user to add to the array.
 * @param emoji - The emoji to add the user ID to.
 */
export const addReaction = (
  reactionArr: { [key: string]: Snowflake[] },
  userId: string,
  emoji: string,
) => {
  reactionArr[emoji].push(userId);
};

/**
 * Removes a user's reaction from the reaction array.
 * @param reactionArr - The reaction array to remove the user's reaction from.
 * @param userId - The ID of the user whose reaction is to be removed.
 * @param emoji - The emoji of the reaction to be removed.
 * @returns The updated reaction array after removing the user's reaction.
 */
export const removeReaction = (
  reactionArr: { [key: string]: Snowflake[] },
  userId: string,
  emoji: string,
) => {
  // if (reactionArr[emoji].length <= 1) {
  //   delete reactionArr[emoji];
  //   return;
  // }

  const userIndex = reactionArr[emoji].indexOf(userId);
  reactionArr[emoji].splice(userIndex, 1);
  return reactionArr;
};

/**
 * Updates reactions on messages in multiple channels.
 * @param channelAndMessageIds An array of objects containing channel and message IDs.
 * @param reactions An object containing the reactions data.
 */
export const updateReactions = async (
  channelAndMessageIds: broadcastedMessages[],
  reactions: { [key: string]: string[] },
) => {
  const connections = await db.connectedList.findMany({
    where: {
      channelId: { in: channelAndMessageIds.map((c) => c.channelId) },
      connected: true,
    },
  });

  // reactions data example: { '👍': ['userId1', 'userId2'], '👎': ['userId1', 'userId2', 'userId3'] }
  // sortedReactions[0] = array of [emoji, users[]]
  // sortedReactions[x] = emojiIds
  // sortedReactions[x][y] = arr of users
  const sortedReactions = sortReactions(reactions);
  const reactionCount = sortedReactions[0][1].length;
  const mostReaction = sortedReactions[0][0];
  const mostReactionEmoji = getEmojiId(mostReaction);

  if (!mostReactionEmoji) return;

  const reactionBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(new CustomID().setIdentifier('reaction_', mostReaction).toString())
      .setEmoji(mostReactionEmoji)
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
          .setCustomId(new CustomID().setIdentifier('reaction_', 'view_all').toString())
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
        const isButton = component.type === ComponentType.Button;
        if (isButton && component.style === ButtonStyle.Secondary) {
          const custom_id = CustomID.parseCustomId(component.custom_id);
          return custom_id.prefix !== 'reaction_' && custom_id.suffix !== 'view_all';
        }
        return true;
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
};
