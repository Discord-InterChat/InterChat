import { hubOption } from '#src/commands/Main/hub/index.js';
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import { CustomID } from '#src/utils/CustomID.js';
import db from '#src/utils/Db.js';
import {
  fetchHub,
  runHubPermissionChecksAndReply,
} from '#src/utils/hub/utils.js';
import {
  ACTION_LABELS,
  buildBlockedWordsBtns,
  buildBlockWordActionsSelect,
  buildBlockWordModal,
  buildBWRuleEmbed,
} from '#src/utils/moderation/blockWords.js';
import type { BlockWordAction } from '@prisma/client';
import {
  ApplicationCommandOptionType,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';

export default class EditBlockWords extends BaseCommand {
  constructor() {
    super({
      name: 'edit',
      description: '📝 Edit an existing blocked word rule in your hub.',
      types: { slash: true, prefix: true },
      options: [
        hubOption,
        {
          type: ApplicationCommandOptionType.String,
          name: 'rule',
          description: 'The name of the rule you want to edit.',
          required: true,
          autocomplete: true,
        },
      ],
    });
  }
  public async execute(ctx: Context) {
    const hubName = ctx.options.getString('hub') ?? undefined;
    const hub = await fetchHub({ name: hubName ?? undefined });
    if (
      !hub ||
			!(await runHubPermissionChecksAndReply(hub, ctx, {
			  checkIfManager: true,
			  checkIfStaff: true,
			}))
    ) return;

    const blockWords = await hub.fetchBlockWords();
    const ruleName = ctx.options.getString('rule');
    const rule = blockWords.find((r) => r.name === ruleName);

    if (!rule) {
      await ctx.replyEmbed('hub.blockwords.notFound', { flags: ['Ephemeral'] });
      return;
    }

    const embed = buildBWRuleEmbed(rule, ctx.client);
    const buttons = buildBlockedWordsBtns(hub.id, rule.id);
    await ctx.reply({ embeds: [embed], components: [buttons] });
  }

  @RegisterInteractionHandler('blockwordsButton', 'editWords')
  async handleEditButtons(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId, ruleId] = customId.args;

    const hub = await fetchHub({ id: hubId });

    if (
      !hub ||
			!(await runHubPermissionChecksAndReply(hub, interaction, {
			  checkIfStaff: true,
			  checkIfManager: true,
			}))
    ) return;

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

  @RegisterInteractionHandler('blockwordsButton', 'configActions')
  async handleConfigureActions(interaction: ButtonInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId, ruleId] = customId.args;

    const hub = await fetchHub({ id: hubId });
    if (
      !hub ||
			!(await runHubPermissionChecksAndReply(hub, interaction, {
			  checkIfStaff: true,
			  checkIfManager: true,
			}))
    ) return;

    const rule = (await hub.fetchBlockWords()).find((r) => r.id === ruleId);
    if (!rule) {
      await interaction.reply({
        content: 'Rule not found',
        flags: ['Ephemeral'],
      });
      return;
    }

    const selectMenu = buildBlockWordActionsSelect(
      hubId,
      ruleId,
      rule.actions || [],
    );
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

    const actionLabels = selectedActions
      .map((action) => ACTION_LABELS[action])
      .join(', ');

    await interaction.update({
      content: `✅ Actions updated for rule: ${actionLabels}`,
      components: [],
    });
  }
}
