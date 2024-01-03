import db from '../utils/Db.js';
import Factory from '../Factory.js';
import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  Snowflake,
  StringSelectMenuBuilder,
  User,
  WebhookClient,
} from 'discord.js';
import { sortReactions } from '../utils/Utils.js';
import { HubSettingsBitField } from '../utils/BitFields.js';
import BlacklistManager from '../managers/BlacklistManager.js';
import { CustomID } from '../utils/CustomID.js';
import { RegisterInteractionHandler } from '../decorators/Interaction.js';
import { emojis } from '../utils/Constants.js';
import { stripIndents } from 'common-tags';
import { t } from '../utils/Locale.js';
import { broadcastedMessages } from '@prisma/client';

export default class ReactionUpdater extends Factory {
  /**
   * Listens for reactions on a message and updates the database with the new reaction data.
   */
  public async listen(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    if (user.bot) return;

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

    if (
      !originalMsg?.hub ||
      !reaction.message.inGuild() ||
      !new HubSettingsBitField(originalMsg.hub.settings).has('Reactions')
    ) {
      return;
    }

    const { userBlacklisted, serverBlacklisted } = await ReactionUpdater.checkBlacklists(
      originalMsg.hub.id,
      reaction.message.guildId,
      user.id,
    );

    if (userBlacklisted || serverBlacklisted) return;

    const reactedEmoji = reaction.emoji.toString();
    const dbReactions = originalMsg.reactions?.valueOf() as { [key: string]: string[] }; // eg. { '👍': 1, '👎': 2 }
    const emojiAlreadyReacted = dbReactions[reactedEmoji] ?? [user.id];

    // max 10 reactions
    if (Object.keys(dbReactions).length >= 10) return;

    // if there already are reactions by others
    // and the user hasn't reacted yet
    !emojiAlreadyReacted?.includes(user.id)
      ? // add user to the array
      ReactionUpdater.addReaction(dbReactions, user.id, reactedEmoji)
      : // or update the data with a new arr containing userId
      (dbReactions[reactedEmoji] = emojiAlreadyReacted);

    await db.originalMessages.update({
      where: { messageId: originalMsg.messageId },
      data: { reactions: dbReactions },
    });

    reaction.users.remove(user.id).catch(() => null);
    ReactionUpdater.updateReactions(originalMsg.broadcastMsgs, dbReactions);
  }

  /** Listens for a reaction button or select menu interaction and updates the reactions accordingly. */
  @RegisterInteractionHandler('reaction_')
  async listenForReactionButton(interaction: ButtonInteraction | AnySelectMenuInteraction) {
    await interaction.deferUpdate();

    const customId = CustomID.parseCustomId(interaction.customId);
    const cooldown = interaction.client.reactionCooldowns.get(interaction.user.id);
    const messageId = interaction.isButton() ? interaction.message.id : customId.args[0];

    const messageInDb = await db.broadcastedMessages.findFirst({
      where: { messageId },
      include: {
        originalMsg: {
          include: {
            hub: { include: { connections: { where: { connected: true } } } },
            broadcastMsgs: true,
          },
        },
      },
    });

    if (
      !interaction.inCachedGuild() ||
      !messageInDb?.originalMsg.hub ||
      !new HubSettingsBitField(messageInDb.originalMsg.hub.settings).has('Reactions')
    ) {
      return;
    }

    const { userBlacklisted, serverBlacklisted } = await ReactionUpdater.checkBlacklists(
      messageInDb.originalMsg.hub.id,
      interaction.guildId,
      interaction.user.id,
    );

    // add user to cooldown list
    interaction.client.reactionCooldowns.set(interaction.user.id, Date.now() + 3000);

    const dbReactions = messageInDb.originalMsg.reactions?.valueOf() as {
      [key: string]: Snowflake[];
    };

    if (customId.suffix === 'view_all') {
      const networkMessage = await db.broadcastedMessages.findFirst({
        where: { messageId },
        include: {
          originalMsg: {
            include: { hub: { include: { connections: { where: { connected: true } } } } },
          },
        },
      });

      if (!networkMessage?.originalMsg.reactions) {
        await interaction.followUp({
          content: 'There are no more reactions to view.',
          ephemeral: true,
        });
        return;
      }

      const sortedReactions = ReactionUpdater.sortReactions(dbReactions);
      let totalReactions = 0;
      let reactionString = '';
      const reactionMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(
            new CustomID().setIdentifier('reaction_').addArgs(interaction.message.id).toString(),
          )
          .setPlaceholder('Add a reaction'),
      );

      const hubSettings = new HubSettingsBitField(networkMessage.originalMsg.hub?.settings);
      if (!hubSettings.has('Reactions')) reactionMenu.components[0].setDisabled(true);

      sortedReactions.forEach((r, index) => {
        if (r[1].length === 0 || index >= 10) return;
        reactionMenu.components[0].addOptions({
          label: 'React/Unreact',
          value: r[0],
          emoji: r[0],
        });
        totalReactions++;
        reactionString += `- ${r[0]}: ${r[1].length}\n`;
      });

      const embed = new EmbedBuilder()
        .setThumbnail(interaction.client.user.displayAvatarURL())
        .setDescription(
          stripIndents`
          ## ${emojis.clipart} Reactions
    
          ${reactionString || 'No reactions yet!'}
    
          **Total Reactions:**
          __${totalReactions}__
      `,
        )
        .setColor('Random');

      await interaction.followUp({
        embeds: [embed],
        components: [reactionMenu],
        ephemeral: true,
      });
    }
    else {
      if (userBlacklisted) {
        await interaction.followUp({
          content: t({ phrase: 'errors.userBlacklisted', locale: interaction.user.locale }),
          ephemeral: true,
        });
        return;
      }
      else if (serverBlacklisted) {
        await interaction.followUp({
          content: t({ phrase: 'errors.userBlacklisted', locale: interaction.user.locale }),
          ephemeral: true,
        });
        return;
      }

      if (cooldown && cooldown > Date.now()) {
        return await interaction.followUp({
          content: `A little quick there! You can react again <t:${Math.round(
            cooldown / 1000,
          )}:R>!`,
          ephemeral: true,
        });
      }

      const reactedEmoji = interaction.isStringSelectMenu()
        ? interaction.values[0]
        : customId.suffix;
      const emojiAlreadyReacted = dbReactions[reactedEmoji];

      if (!emojiAlreadyReacted) {
        return await interaction.followUp({
          content: `${emojis.no} This reaction doesn't exist.`,
          ephemeral: true,
        });
      }

      emojiAlreadyReacted.includes(interaction.user.id)
        ? // If the user already reacted, remove the reaction
        ReactionUpdater.removeReaction(dbReactions, interaction.user.id, reactedEmoji)
        : // or else add the user to the array
        ReactionUpdater.addReaction(dbReactions, interaction.user.id, reactedEmoji);

      await db.originalMessages.update({
        where: { messageId: messageInDb.originalMsgId },
        data: { reactions: dbReactions },
      });

      if (interaction.isStringSelectMenu()) {
        // FIXME seems like emojiAlreadyReacted is getting mutated somewhere
        const action = emojiAlreadyReacted.includes(interaction.user.id) ? 'reacted' : 'unreacted';
        interaction
          .followUp({
            content: `You have ${action} with ${reactedEmoji}!`,
            ephemeral: true,
          })
          .catch(() => null);
      }

      // reflect the changes in the message's buttons
      await ReactionUpdater.updateReactions(messageInDb.originalMsg.broadcastMsgs, dbReactions);
    }
  }

  /* static methods so we can call them within the decorator */

  /**
   * Updates reactions on messages in multiple channels.
   * @param channelAndMessageIds An array of objects containing channel and message IDs.
   * @param reactions An object containing the reactions data.
   */
  static async updateReactions(
    channelAndMessageIds: broadcastedMessages[],
    reactions: { [key: string]: string[] },
  ): Promise<void> {
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

    const reactionBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(new CustomID().setIdentifier('reaction_', mostReaction).toString())
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


      // FIXME: Fix not being able to react to messages with no reply button
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
  }

  /**
   * Checks if a user or server is blacklisted in a given hub.
   * @param hubId - The ID of the hub to check in.
   * @param guildId - The ID of the guild to check for blacklist.
   * @param userId - The ID of the user to check for blacklist.
   * @returns An object containing whether the user and/or server is blacklisted in the hub.
   */
  static async checkBlacklists(hubId: string, guildId: string, userId: string) {
    const userBlacklisted = await BlacklistManager.fetchUserBlacklist(hubId, userId);
    const guildBlacklisted = await BlacklistManager.fetchUserBlacklist(hubId, guildId);
    if (userBlacklisted || guildBlacklisted) {
      return { userBlacklisted, serverBlacklisted: guildBlacklisted };
    }

    return { userBlacklisted: false, serverBlacklisted: false };
  }

  /**
   * Adds a user ID to the array of user IDs for a given emoji in the reactionArr object.
   * @param reactionArr - The object containing arrays of user IDs for each emoji.
   * @param userId - The ID of the user to add to the array.
   * @param emoji - The emoji to add the user ID to.
   */
  static addReaction(reactionArr: { [key: string]: Snowflake[] }, userId: string, emoji: string) {
    reactionArr[emoji].push(userId);
  }

  /**
   * Removes a user's reaction from the reaction array.
   * @param reactionArr - The reaction array to remove the user's reaction from.
   * @param userId - The ID of the user whose reaction is to be removed.
   * @param emoji - The emoji of the reaction to be removed.
   * @returns The updated reaction array after removing the user's reaction.
   */
  static removeReaction(
    reactionArr: { [key: string]: Snowflake[] },
    userId: string,
    emoji: string,
  ) {
    const userIndex = reactionArr[emoji].indexOf(userId);
    reactionArr[emoji].splice(userIndex, 1);
    return reactionArr;
  }

  /**
   * Sorts the reactions object based on the reaction counts.
   * @param reactions - The reactions object to be sorted.
   * @returns The sorted reactions object in the form of an array.
   * The array is sorted in descending order based on the length of the reaction arrays.
   * Each element of the array is a tuple containing the reaction and its corresponding array of user IDs.
   *
   * ### Example:
   * ```js
   * [ [ '👎', ['1020193019332334'] ], [ '👍', ['1020193019332334'] ] ]
   * ```
   */
  static sortReactions(reactions: { [key: string]: string[] }) {
    return Object.entries(reactions).sort((a, b) => b[1].length - a[1].length);
  }
}
