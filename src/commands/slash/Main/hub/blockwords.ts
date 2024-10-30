import HubCommand from '#main/commands/slash/Main/hub/index.js';
import { emojis } from '#main/config/Constants.js';
import { RegisterInteractionHandler } from '#main/decorators/Interaction.js';
import { ACTION_LABELS, buildBlockWordsListEmbed } from '#main/utils/moderation/blockWords.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { isStaffOrHubMod } from '#utils/hub/utils.js';
import { t } from '#utils/Locale.js';
import {
  buildBlockWordsActionsSelect,
  buildBWRuleEmbed,
  buildBlockWordsModal,
  buildBlockedWordsBtns,
  sanitizeWords,
} from '#utils/moderation/blockWords.js';
import { BlockWordAction, Hub, MessageBlockList } from '@prisma/client';
import {
  RepliableInteraction,
  StringSelectMenuInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js';

export default class BlockWordCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const hubName = interaction.options.getString('hub', true);
    const hub = await this.fetchHub({ name: hubName });

    if (!hub || !isStaffOrHubMod(interaction.user.id, hub)) {
      const locale = await this.getLocale(interaction);
      await this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: emojis.no }), {
        ephemeral: true,
      });
      return;
    }

    switch (interaction.options.getSubcommand()) {
      case 'edit':
        await this.handleEditSubcommand(interaction, hub);
        break;
      case 'list':
        await this.handleList(interaction, hub);
        break;
      case 'create':
        await this.handleAdd(interaction, hub);
        break;
      default:
        break;
    }
  }

  @RegisterInteractionHandler('blockwordsButton', 'editWords')
  async handleEditButtons(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId, ruleId] = customId.args;

    const hub = await this.fetchHub({ id: hubId });

    if (!hub || !isStaffOrHubMod(interaction.user.id, hub)) {
      const locale = await this.getLocale(interaction);
      await this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: emojis.no }), {
        ephemeral: true,
      });
      return;
    }

    const blockWords = hub.msgBlockList;
    const presetRule = blockWords.find((r) => r.id === ruleId);

    if (!presetRule) {
      await interaction.reply({ content: 'This rule does not exist.', ephemeral: true });
      return;
    }

    const modal = buildBlockWordsModal(hub.id, { presetRule });
    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('blockwordsModal')
  async handleModals(interaction: ModalSubmitInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId, ruleId] = customId.args as [string, string?];

    const hub = await this.fetchHub({ id: hubId });
    if (!hub) return;

    await interaction.reply({
      content: `${emojis.loading} Validating blocked words...`,
      ephemeral: true,
    });

    const name = interaction.fields.getTextInputValue('name');
    const newWords = sanitizeWords(interaction.fields.getTextInputValue('words'));
    if (!ruleId) {
      if (hub.msgBlockList.length >= 2) {
        await interaction.editReply('You can only have 2 block word rules per hub.');
        return;
      }

      const rule = await db.messageBlockList.create({
        data: { hubId, name, createdBy: interaction.user.id, words: newWords },
      });

      const embed = buildBWRuleEmbed(rule);
      const buttons = buildBlockedWordsBtns(hub.id, rule.id);
      await interaction.editReply({
        content: `${emojis.yes} Rule added.`,
        embeds: [embed],
        components: [buttons],
      });
    }
    else if (newWords.length === 0) {
      await db.messageBlockList.delete({ where: { id: ruleId } });
      await interaction.editReply(`${emojis.yes} Rule removed.`);
    }
    else {
      await db.messageBlockList.update({ where: { id: ruleId }, data: { words: newWords, name } });
      await interaction.editReply(`${emojis.yes} Rule updated.`);
    }
  }

  @RegisterInteractionHandler('blockwordsButton', 'configActions')
  async handleConfigureActions(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId, ruleId] = customId.args;

    const hub = await this.fetchHub({ id: hubId });
    if (!hub || !isStaffOrHubMod(interaction.user.id, hub)) {
      const locale = await this.getLocale(interaction);
      await this.replyEmbed(interaction, t('hub.notFound_mod', locale, { emoji: emojis.no }), {
        ephemeral: true,
      });
      return;
    }

    const rule = hub.msgBlockList.find((r) => r.id === ruleId);
    if (!rule) {
      await interaction.reply({ content: 'Rule not found', ephemeral: true });
      return;
    }

    const selectMenu = buildBlockWordsActionsSelect(hubId, ruleId, rule.actions || []);
    await interaction.reply({
      content: `Configure actions for rule: ${rule.name}`,
      components: [selectMenu],
      ephemeral: true,
    });
  }

  @RegisterInteractionHandler('blockwordsSelect', 'actions')
  async handleActionSelection(interaction: StringSelectMenuInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const ruleId = customId.args[1];
    const selectedActions = interaction.values as BlockWordAction[];

    await db.messageBlockList.update({
      where: { id: ruleId },
      data: { actions: selectedActions },
    });

    const actionLabels = selectedActions.map((action) => ACTION_LABELS[action]).join(', ');
    await interaction.update({
      content: `✅ Actions updated for rule: ${actionLabels}`,
      components: [],
    });
  }

  private async handleEditSubcommand(
    interaction: ChatInputCommandInteraction,
    hub: Hub & { msgBlockList: MessageBlockList[] },
  ) {
    const ruleName = interaction.options.getString('rule', true);
    const rule = hub.msgBlockList.find((r) => r.name === ruleName);

    if (!rule) {
      await this.replyWithNotFound(interaction);
      return;
    }

    const embed = buildBWRuleEmbed(rule);
    const buttons = buildBlockedWordsBtns(hub.id, rule.id);
    await interaction.reply({ embeds: [embed], components: [buttons] });
  }

  private async handleList(
    interaction: ChatInputCommandInteraction,
    hub: Hub & { msgBlockList: MessageBlockList[] },
  ) {
    if (!hub.msgBlockList) {
      await this.replyWithNotFound(interaction);
      return;
    }

    const embed = buildBlockWordsListEmbed(hub.msgBlockList);
    await interaction.reply({ embeds: [embed] });
  }

  private async handleAdd(interaction: ChatInputCommandInteraction | ButtonInteraction, hub: Hub) {
    const modal = buildBlockWordsModal(hub.id);
    await interaction.showModal(modal);
  }

  private async fetchHub({ id, name }: { id?: string; name?: string }) {
    return await db.hub.findFirst({ where: { id, name }, include: { msgBlockList: true } });
  }

  private async replyWithNotFound(interaction: RepliableInteraction) {
    await this.replyEmbed(
      interaction,
      'No block word rules are in this hub yet or selected rule name is invalid. Use `/hub blockwords add` to add some or `/hub blockwords list` to list all created rules.',
      { ephemeral: true },
    );
  }
}
