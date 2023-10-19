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
import { messageData, MessageDataChannelAndMessageIds } from '@prisma/client';
import { sortReactions } from '../utils/Utils.js';
import { HubSettingsBitField } from '../utils/BitFields.js';
import BlacklistManager from '../structures/BlacklistManager.js';
import { CustomID } from '../structures/CustomID.js';
import { Interaction } from '../decorators/Interaction.js';
import { emojis } from '../utils/Constants.js';
import { stripIndents } from 'common-tags';

type messageAndHubSettings = messageData & { hub: { settings: number } | null };

export default class ReactionUpdater extends Factory {
  public async listenForReactions(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ): Promise<void> {
    if (user.bot) return;

    const cooldown = reaction.client.reactionCooldowns.get(user.id);
    if (cooldown && cooldown > Date.now()) return;

    // add user to cooldown list
    user.client.reactionCooldowns.set(user.id, Date.now() + 3000);

    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId: reaction.message.id } } },
      include: { hub: { select: { settings: true } } },
    });

    if (!messageInDb || !reaction.message.inGuild() || !ReactionUpdater.runChecks(messageInDb)) {
      return;
    }

    const { userBlacklisted, serverBlacklisted } = await ReactionUpdater.checkBlacklists(
      messageInDb,
      reaction.message.guildId,
      user.id,
    );

    if (userBlacklisted || serverBlacklisted) return;

    const reactedEmoji = reaction.emoji.toString();
    const dbReactions = messageInDb.reactions?.valueOf() as { [key: string]: string[] }; // eg. { '👍': 1, '👎': 2 }
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

    await db.messageData.update({
      where: { id: messageInDb.id },
      data: { reactions: dbReactions },
    });

    reaction.users.remove(user.id).catch(() => null);
    ReactionUpdater.updateReactions(messageInDb.channelAndMessageIds, dbReactions);
  }

  @Interaction('reaction_')
  async listenForReactionButton(interaction: ButtonInteraction | AnySelectMenuInteraction) {
    await interaction.deferUpdate();

    const customId = CustomID.parseCustomId(interaction.customId);
    const cooldown = interaction.client.reactionCooldowns.get(interaction.user.id);
    const messageId = interaction.isButton() ? interaction.message.id : customId.args[0];

    const messageInDb = await db.messageData.findFirst({
      where: { channelAndMessageIds: { some: { messageId } } },
      include: {
        hub: { select: { connections: { where: { connected: true } }, settings: true } },
      },
    });

    if (!messageInDb || !interaction.inCachedGuild() || !ReactionUpdater.runChecks(messageInDb)) {
      return;
    }

    const { userBlacklisted, serverBlacklisted } = await ReactionUpdater.checkBlacklists(
      messageInDb,
      interaction.guildId,
      interaction.user.id,
    );

    // add user to cooldown list
    interaction.client.reactionCooldowns.set(interaction.user.id, Date.now() + 3000);

    const dbReactions = messageInDb.reactions?.valueOf() as { [key: string]: Snowflake[] };

    if (customId.postfix === 'view_all') {
      const networkMessage = await db.messageData.findFirst({
        where: { channelAndMessageIds: { some: { messageId: interaction.message.id } } },
        include: {
          hub: { select: { connections: { where: { connected: true } }, settings: true } },
        },
      });

      if (!networkMessage?.reactions) {
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

      const hubSettings = new HubSettingsBitField(networkMessage.hub?.settings);
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
          content: 'You are blacklisted from this hub.',
          ephemeral: true,
        });
        return;
      }
      else if (serverBlacklisted) {
        await interaction.followUp({
          content: 'This server is blacklisted from this hub.',
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
        : customId.postfix;
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

      await db.messageData.update({
        where: { id: messageInDb.id },
        data: { reactions: dbReactions },
      });

      if (interaction.isStringSelectMenu()) {
        // FIXME seems like emojiAlreadyReacted is getting mutated somewhere
        const action = emojiAlreadyReacted.includes(interaction.user.id) ? 'reacted' : 'unreacted';
        interaction.followUp({
          content: `You have ${action} with ${reactedEmoji}!`,
          ephemeral: true,
        }).catch(() => null);
      }

      // reflect the changes in the message's buttons
      await ReactionUpdater.updateReactions(messageInDb.channelAndMessageIds, dbReactions);
    }
  }

  // making methods static so we can use them in the decorator
  static async updateReactions(
    channelAndMessageIds: MessageDataChannelAndMessageIds[],
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

      const components = message?.components?.filter((row) => {
        // filter all buttons that are not reaction buttons
        row.components = row.components.filter((component) => {
          return component.type === ComponentType.Button &&
            component.style === ButtonStyle.Secondary
            ? !component.custom_id.startsWith('reaction_') &&
                component.custom_id !== 'reaction_:view_all'
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

  static runChecks(messageInDb: messageAndHubSettings) {
    if (
      !messageInDb.hub ||
      !messageInDb.hubId ||
      !new HubSettingsBitField(messageInDb.hub.settings).has('Reactions')
    ) {
      return false;
    }

    return true;
  }

  static async checkBlacklists(
    messageInDb: messageAndHubSettings | null,
    guildId: string,
    userId: string,
  ) {
    if (!messageInDb?.hubId) return { userBlacklisted: false, serverBlacklisted: false };

    const userBlacklisted = await BlacklistManager.fetchUserBlacklist(messageInDb.hubId, userId);
    const guildBlacklisted = await BlacklistManager.fetchUserBlacklist(messageInDb.hubId, guildId);
    if (userBlacklisted || guildBlacklisted) {
      return { userBlacklisted, serverBlacklisted: guildBlacklisted };
    }

    return { userBlacklisted: false, serverBlacklisted: false };
  }

  static addReaction(reactionArr: { [key: string]: Snowflake[] }, userId: string, emoji: string) {
    reactionArr[emoji].push(userId);
  }
  static removeReaction(
    reactionArr: { [key: string]: Snowflake[] },
    userId: string,
    emoji: string,
  ) {
    const userIndex = reactionArr[emoji].indexOf(userId);
    reactionArr[emoji].splice(userIndex, 1);
    return reactionArr;
  }

  static sortReactions(reactions: { [key: string]: string[] }) {
    // Sort the array based on the reaction counts
    /* { '👍': ['10201930193'], '👎': ['10201930193'] } // before Object.entries
     => [ [ '👎', ['10201930193'] ], [ '👍', ['10201930193'] ] ] // after Object.entries
  */
    return Object.entries(reactions).sort((a, b) => b[1].length - a[1].length);
  }
}
