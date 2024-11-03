import Constants, { emojis } from '#utils/Constants.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import HubSettingsManager from '#main/managers/HubSettingsManager.js';
import { HubSettingsBitField } from '#main/modules/BitFields.js';
import { fetchHub } from '#main/utils/hub/utils.js';
import {
  findOriginalMessage,
  getOriginalMessage,
  OriginalMessage,
  storeMessage,
} from '#main/utils/network/messageUtils.js';
import { CustomID, ParsedCustomId } from '#utils/CustomID.js';
import { t } from '#utils/Locale.js';
import { addReaction, removeReaction, updateReactions } from '#utils/reaction/actions.js';
import { checkBlacklists } from '#utils/reaction/helpers.js';
import sortReactions from '#utils/reaction/sortReactions.js';
import { getEmojiId } from '#utils/Utils.js';
import { Hub } from '@prisma/client';
import { stripIndents } from 'common-tags';
import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  ButtonInteraction,
  EmbedBuilder,
  Snowflake,
  StringSelectMenuBuilder,
  time,
} from 'discord.js';

export default class NetworkReactionInteraction {
  @RegisterInteractionHandler('reaction_')
  async listenForReactionButton(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
  ): Promise<void> {
    await interaction.deferUpdate();
    if (!interaction.inCachedGuild()) return;

    const { customId, messageId } = this.getInteractionDetails(interaction);
    const originalMessage =
      (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId));
    const hub = originalMessage ? await fetchHub(originalMessage?.hubId) : null;

    if (!originalMessage || !this.isReactionAllowed(hub)) return;

    const { userBlacklisted, serverBlacklisted } = await this.checkUserPermissions(
      hub,
      interaction,
    );
    if (userBlacklisted || serverBlacklisted) {
      await this.handleBlacklistedUser(interaction, userBlacklisted);
      return;
    }

    if (await this.isUserOnCooldown(interaction)) return;

    if (customId.suffix === 'view_all') {
      await this.handleViewAllReactions(interaction, messageId, hub);
    }
    else {
      await this.handleReactionToggle(interaction, originalMessage, customId);
    }
  }

  private getInteractionDetails(interaction: ButtonInteraction | AnySelectMenuInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const messageId = interaction.isButton() ? interaction.message.id : customId.args[0];
    return { customId, messageId };
  }

  private isReactionAllowed(hub: Hub | null): hub is Hub {
    return Boolean(hub && new HubSettingsBitField(hub.settings).has('Reactions'));
  }

  private async checkUserPermissions(
    hub: Hub,
    interaction: ButtonInteraction | AnySelectMenuInteraction,
  ) {
    return await checkBlacklists(hub.id, interaction.guildId, interaction.user.id);
  }

  private async handleBlacklistedUser(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    userBlacklisted: boolean,
  ) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const phrase = userBlacklisted ? 'errors.userBlacklisted' : 'errors.serverBlacklisted';
    await interaction.followUp({
      content: t(phrase, locale, { emoji: emojis.no }),
      ephemeral: true,
    });
  }

  private async isUserOnCooldown(interaction: ButtonInteraction | AnySelectMenuInteraction) {
    const cooldown = interaction.client.reactionCooldowns.get(interaction.user.id);
    if (cooldown && cooldown > Date.now()) {
      const timeString = time(Math.round(cooldown / 1000), 'R');
      await interaction.followUp({
        content: `A little quick there! You can react again ${timeString}!`,
        ephemeral: true,
      });
      return true;
    }
    interaction.client.reactionCooldowns.set(interaction.user.id, Date.now() + 3000);
    return false;
  }

  private async handleViewAllReactions(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    messageId: string,
    hub: Hub,
  ) {
    const originalMessage =
      (await getOriginalMessage(messageId)) ?? (await findOriginalMessage(messageId));
    if (!originalMessage?.reactions || !originalMessage.hubId) {
      await interaction.followUp({
        content: 'There are no more reactions to view.',
        ephemeral: true,
      });
      return;
    }

    const dbReactions = originalMessage.reactions as { [key: string]: Snowflake[] };
    const { reactionMenu, reactionString, totalReactions } = this.buildReactionMenu(
      dbReactions,
      interaction,
      hub,
    );

    const embed = this.buildReactionEmbed(reactionString, totalReactions);

    await interaction.followUp({
      embeds: [embed],
      components: [reactionMenu],
      ephemeral: true,
    });
  }

  private buildReactionMenu(
    dbReactions: { [key: string]: Snowflake[] },
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    hub: Hub,
  ) {
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

    return { reactionMenu, reactionString, totalReactions };
  }

  private buildReactionEmbed(reactionString: string, totalReactions: number) {
    return new EmbedBuilder()
      .setDescription(
        stripIndents`
          ## ${emojis.clipart} Reactions

          ${reactionString || 'No reactions yet!'}

          **Total Reactions:**
          __${totalReactions}__
      `,
      )
      .setColor(Constants.Colors.invisible);
  }

  private async handleReactionToggle(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    originalMessage: OriginalMessage,
    customId: ParsedCustomId,
  ) {
    const dbReactions = (originalMessage.reactions?.valueOf() ?? {}) as {
      [key: string]: Snowflake[];
    };

    const reactedEmoji = interaction.isStringSelectMenu() ? interaction.values[0] : customId.suffix;
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

    await this.updateReactionsInDb(originalMessage, dbReactions);
    await this.sendReactionConfirmation(interaction, emojiAlreadyReacted, reactedEmoji);

    await updateReactions(originalMessage, dbReactions);
  }

  private async updateReactionsInDb(
    originalMessage: OriginalMessage,
    reactions: { [key: string]: Snowflake[] },
  ) {
    await storeMessage(originalMessage.messageId, { ...originalMessage, reactions });
  }

  private async sendReactionConfirmation(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    emojiAlreadyReacted: Snowflake[],
    reactedEmoji: string,
  ) {
    if (interaction.isStringSelectMenu()) {
      const action = emojiAlreadyReacted.includes(interaction.user.id) ? 'reacted' : 'unreacted';
      await interaction
        .followUp({
          content: `You have ${action} with ${reactedEmoji}!`,
          ephemeral: true,
        })
        .catch(() => null);
    }
  }
}
