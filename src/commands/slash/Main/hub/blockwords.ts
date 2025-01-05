import HubCommand from '#main/commands/slash/Main/hub/index.js';
import { RegisterInteractionHandler } from '#main/decorators/RegisterInteractionHandler.js';
import { ACTION_LABELS, buildBlockWordListEmbed } from '#main/utils/moderation/blockWords.js';

import type { BlockWord, BlockWordAction } from '@prisma/client';
import {
  ButtonBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type RepliableInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { CustomID } from '#utils/CustomID.js';
import db from '#utils/Db.js';
import { t } from '#utils/Locale.js';
import { isStaffOrHubMod } from '#utils/hub/utils.js';
import {
  buildBWRuleEmbed,
  buildBlockWordActionsSelect,
  buildBlockWordModal,
  buildBlockedWordsBtns,
  sanitizeWords,
} from '#utils/moderation/blockWords.js';

export default class BlockWordCommand extends HubCommand {
  async execute(interaction: ChatInputCommandInteraction) {
    const hubName = interaction.options.getString('hub', true);
    const hub = (await this.hubService.findHubsByName(hubName)).at(0);

    if (!hub) {
      const locale = await this.getLocale(interaction);
      await this.replyEmbed(
        interaction,
        t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }),
        {
          flags: ['Ephemeral'],
        },
      );
      return;
    }

    if (!(await isStaffOrHubMod(interaction.user.id, hub))) {
      const locale = await this.getLocale(interaction);
      await this.replyEmbed(
        interaction,
        t('hub.notManager', locale, { emoji: this.getEmoji('x_icon') }),
        { flags: ['Ephemeral'] },
      );
      return;
    }

    const blockWords = await hub.fetchBlockWords();

    const handlers = {
      edit: () => this.handleEditSubcommand(interaction, hub.id, blockWords),
      list: () => this.handleList(interaction, blockWords),
      create: () => this.handleAdd(interaction, hub.id),
    };

    const subcommand = interaction.options.getSubcommand(true) as keyof typeof handlers;
    await handlers[subcommand]?.();
  }

  @RegisterInteractionHandler('blockwordsButton', 'editWords')
  async handleEditButtons(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId, ruleId] = customId.args;

    const hub = await this.fetchHub({ id: hubId });

    if (!hub || !(await isStaffOrHubMod(interaction.user.id, hub))) {
      const locale = await this.getLocale(interaction);
      await this.replyEmbed(
        interaction,
        t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }),
        {
          flags: ['Ephemeral'],
        },
      );
      return;
    }

    const blockWords = await hub.fetchBlockWords();
    const presetRule = blockWords.find((r) => r.id === ruleId);

    if (!presetRule) {
      await interaction.reply({
        content: 'This rule does not exist.',
        flags: ['Ephemeral'],
      });
      return;
    }

    const modal = buildBlockWordModal(hub.id, { presetRule });
    await interaction.showModal(modal);
  }

  @RegisterInteractionHandler('blockwordsModal')
  async handleModals(interaction: ModalSubmitInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId, ruleId] = customId.args as [string, string?];

    const hub = await this.fetchHub({ id: hubId });
    if (!hub) return;

    await interaction.reply({
      content: `${this.getEmoji('loading')} Validating blocked words...`,
      flags: ['Ephemeral'],
    });

    const name = interaction.fields.getTextInputValue('name');
    const newWords = sanitizeWords(interaction.fields.getTextInputValue('words'));

    // new rule
    if (!ruleId) {
      if ((await hub.fetchBlockWords()).length >= 2) {
        await interaction.editReply('You can only have 2 block word rules per hub.');
        return;
      }

      const rule = await db.blockWord.create({
        data: { hubId, name, createdBy: interaction.user.id, words: newWords },
      });

      const embed = buildBWRuleEmbed(rule, interaction.client);
      const buttons = buildBlockedWordsBtns(hub.id, rule.id).addComponents(new ButtonBuilder());
      await interaction.editReply({
        content: `${this.getEmoji('tick_icon')} Rule added.`,
        embeds: [embed],
        components: [buttons],
      });
    }
    // remove rule
    else if (newWords.length === 0) {
      await db.blockWord.delete({ where: { id: ruleId } });
      await interaction.editReply(`${this.getEmoji('tick_icon')} Rule removed.`);
    }

    // update rule
    else {
      await db.blockWord.update({
        where: { id: ruleId },
        data: { words: newWords, name },
      });
      await interaction.editReply(`${this.getEmoji('tick_icon')} Rule updated.`);
    }
  }

  @RegisterInteractionHandler('blockwordsButton', 'configActions')
  async handleConfigureActions(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId, ruleId] = customId.args;

    const hub = await this.fetchHub({ id: hubId });
    if (!hub || !(await isStaffOrHubMod(interaction.user.id, hub))) {
      const locale = await this.getLocale(interaction);
      await this.replyEmbed(
        interaction,
        t('hub.notFound_mod', locale, { emoji: this.getEmoji('x_icon') }),
        {
          flags: ['Ephemeral'],
        },
      );
      return;
    }

    const rule = (await hub.fetchBlockWords()).find((r) => r.id === ruleId);
    if (!rule) {
      await interaction.reply({
        content: 'Rule not found',
        flags: ['Ephemeral'],
      });
      return;
    }

    const selectMenu = buildBlockWordActionsSelect(hubId, ruleId, rule.actions || []);
    await interaction.reply({
      content: `Configure actions for rule: ${rule.name}`,
      components: [selectMenu],
      flags: ['Ephemeral'],
    });
  }

  @RegisterInteractionHandler('blockwordsSelect', 'actions')
  async handleActionSelection(interaction: StringSelectMenuInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const ruleId = customId.args[1];
    const selectedActions = interaction.values as BlockWordAction[];

    await db.blockWord.update({
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
    hubId: string,
    blockWords: BlockWord[],
  ) {
    const ruleName = interaction.options.getString('rule', true);
    const rule = blockWords.find((r) => r.name === ruleName);

    if (!rule) {
      await this.replyWithNotFound(interaction);
      return;
    }

    const embed = buildBWRuleEmbed(rule, interaction.client);
    const buttons = buildBlockedWordsBtns(hubId, rule.id);
    await interaction.reply({ embeds: [embed], components: [buttons] });
  }

  private async handleList(interaction: ChatInputCommandInteraction, blockWords: BlockWord[]) {
    if (!blockWords.length) {
      await this.replyWithNotFound(interaction);
      return;
    }

    const embed = buildBlockWordListEmbed(blockWords, interaction.client);
    await interaction.reply({ embeds: [embed] });
  }

  private async handleAdd(
    interaction: ChatInputCommandInteraction | ButtonInteraction,
    hubId: string,
  ) {
    const modal = buildBlockWordModal(hubId);
    await interaction.showModal(modal);
  }

  private async fetchHub({ id, name }: { id?: string; name?: string }) {
    if (id) return await this.hubService.fetchHub(id);
    if (name) return (await this.hubService.findHubsByName(name)).at(0);
    return null;
  }

  private async replyWithNotFound(interaction: RepliableInteraction) {
    await this.replyEmbed(
      interaction,
      'No block word rules are in this hub yet or selected rule name is invalid. Use `/hub blockwords add` to add some or `/hub blockwords list` to list all created rules.',
      { flags: ['Ephemeral'] },
    );
  }
}
