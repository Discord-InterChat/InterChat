/* eslint-disable complexity */
import db from './Db.js';
import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  ButtonInteraction,
  EmbedBuilder,
  Snowflake,
  StringSelectMenuBuilder,
  time,
} from 'discord.js';
import { getEmojiId, sortReactions } from './Utils.js';
import { HubSettingsBitField } from './BitFields.js';
import { CustomID } from './CustomID.js';
import { RegisterInteractionHandler } from '../decorators/Interaction.js';
import { emojis } from './Constants.js';
import { stripIndents } from 'common-tags';
import { t } from './Locale.js';
import { removeReaction, addReaction, updateReactions } from '../scripts/reaction/actions.js';
import { checkBlacklists } from '../scripts/reaction/helpers.js';

export default class ReactionUpdater {
  /** Listens for a reaction button or select menu interaction and updates the reactions accordingly. */
  @RegisterInteractionHandler('reaction_')
  async listenForReactionButton(interaction: ButtonInteraction | AnySelectMenuInteraction) {
    await interaction.deferUpdate();

    if (!interaction.inCachedGuild()) return;

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
      !messageInDb?.originalMsg.hub ||
      !new HubSettingsBitField(messageInDb.originalMsg.hub.settings).has('Reactions')
    ) {
      return;
    }

    const { userBlacklisted, serverBlacklisted } = await checkBlacklists(
      messageInDb.originalMsg.hub.id,
      interaction.guildId,
      interaction.user.id,
    );

    // add user to cooldown list
    interaction.client.reactionCooldowns.set(interaction.user.id, Date.now() + 3000);

    const dbReactions = (messageInDb.originalMsg.reactions?.valueOf() ?? {}) as {
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

      const sortedReactions = sortReactions(dbReactions);
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
          emoji: getEmojiId(r[0]),
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
          content: t(
            { phrase: 'errors.userBlacklisted', locale: interaction.user.locale },
            { emoji: emojis.no },
          ),
          ephemeral: true,
        });
        return;
      }
      else if (serverBlacklisted) {
        await interaction.followUp({
          content: t(
            { phrase: 'errors.userBlacklisted', locale: interaction.user.locale },
            { emoji: emojis.no },
          ),
          ephemeral: true,
        });
        return;
      }

      if (cooldown && cooldown > Date.now()) {
        const timeString = time(Math.round(cooldown / 1000), 'R');
        return await interaction.followUp({
          content: `A little quick there! You can react again ${timeString}!`,
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
        removeReaction(dbReactions, interaction.user.id, reactedEmoji)
        : // or else add the user to the array
        addReaction(dbReactions, interaction.user.id, reactedEmoji);

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
      await updateReactions(messageInDb.originalMsg.broadcastMsgs, dbReactions);
    }
  }
}