/* eslint-disable complexity */
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { addReaction, removeReaction, updateReactions } from '#main/utils/reaction/actions.js';
import { checkBlacklists } from '#main/utils/reaction/helpers.js';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  ButtonInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  time,
  type AnySelectMenuInteraction,
  type Snowflake,
} from 'discord.js';
import Constants, { emojis } from './config/Constants.js';
import { HubSettingsBitField } from './modules/BitFields.js';
import { fetchConnection, updateConnection } from './utils/ConnectedListUtils.js';
import { CustomID } from './utils/CustomID.js';
import db from './utils/Db.js';
import { t } from './utils/Locale.js';
import { getEmojiId, simpleEmbed, sortReactions } from './utils/Utils.js';
import HubSettingsManager from '#main/modules/HubSettingsManager.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';

export class RandomComponents {
  /** Listens for a reaction button or select menu interaction and updates the reactions accordingly. */
  @RegisterInteractionHandler('reaction_')
  async listenForReactionButton(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
  ): Promise<void> {
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
      interaction.client,
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

      if (!networkMessage?.originalMsg.reactions || !networkMessage?.originalMsg.hub) {
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

      const { hub } = networkMessage.originalMsg;
      const hubSettings = new HubSettingsManager(hub.id, hub.settings);
      if (!hubSettings.getSetting('Reactions')) reactionMenu.components[0].setDisabled(true);

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
        .setColor(Constants.Colors.invisible);

      await interaction.followUp({
        embeds: [embed],
        components: [reactionMenu],
        ephemeral: true,
      });
    }
    else {
      const { userManager } = interaction.client;
      const locale = await userManager.getUserLocale(interaction.user.id);

      if (userBlacklisted || serverBlacklisted) {
        const phrase = userBlacklisted ? 'errors.userBlacklisted' : 'errors.serverBlacklisted';
        await interaction.followUp({
          content: t({ phrase, locale }, { emoji: emojis.no }),
          ephemeral: true,
        });
        return;
      }

      if (cooldown && cooldown > Date.now()) {
        const timeString = time(Math.round(cooldown / 1000), 'R');
        await interaction.followUp({
          content: `A little quick there! You can react again ${timeString}!`,
          ephemeral: true,
        });
        return;
      }

      const reactedEmoji = interaction.isStringSelectMenu()
        ? interaction.values[0]
        : customId.suffix;
      const emojiAlreadyReacted = dbReactions[reactedEmoji];

      if (!emojiAlreadyReacted) {
        await interaction.followUp({
          content: `${emojis.no} This reaction doesn't exist.`,
          ephemeral: true,
        });
        return;
      }

      if (emojiAlreadyReacted.includes(interaction.user.id)) {
        removeReaction(dbReactions, interaction.user.id, reactedEmoji);
      }
      else {
        addReaction(dbReactions, interaction.user.id, reactedEmoji);
      }

      await db.originalMessages.update({
        where: { messageId: messageInDb.originalMsgId },
        data: { reactions: dbReactions },
      });

      if (interaction.isStringSelectMenu()) {
        /** FIXME: seems like `emojiAlreadyReacted` is getting mutated somewhere */
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

  @RegisterInteractionHandler('inactiveConnect', 'toggle')
  async inactiveConnect(interaction: ButtonInteraction): Promise<void> {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [channelId] = customId.args;

    const connection = await fetchConnection(channelId);
    if (!connection) {
      const locale = await interaction.client.userManager.getUserLocale(interaction.user.id);
      const notFoundEmbed = new InfoEmbed().setDescription(
        t({ phrase: 'connection.channelNotFound', locale }, { emoji: emojis.no }),
      );

      await interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
      return;
    }

    await updateConnection({ channelId }, { connected: true });

    await interaction.update({
      embeds: [
        simpleEmbed(
          `### ${emojis.tick} Connection Resumed\nConnection has been resumed. Have fun chatting!`,
        ),
      ],
      components: [],
    });
  }
}
