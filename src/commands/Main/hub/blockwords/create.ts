import { hubOption } from '#src/commands/Main/hub/index.js';
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { RegisterInteractionHandler } from '#src/decorators/RegisterInteractionHandler.js';
import { CustomID } from '#src/utils/CustomID.js';
import db from '#src/utils/Db.js';
import { getEmoji } from '#src/utils/EmojiUtils.js';
import {
  fetchHub,
  runHubPermissionChecksAndReply,
} from '#src/utils/hub/utils.js';
import {
  buildBlockedWordsBtns,
  buildBlockWordModal,
  buildBWRuleEmbed,
  sanitizeWords,
} from '#src/utils/moderation/blockWords.js';
import { type AutocompleteInteraction, ButtonBuilder, type ModalSubmitInteraction } from 'discord.js';

export async function getBlockWordRules(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  const hubName = interaction.options.getString('hub');

  if (focused.name === 'rule') {
    if (!hubName) return [{ name: 'Please select a hub first.', value: '' }];

    const rules = await db.blockWord.findMany({
      where: { hub: { name: hubName } },
      select: { id: true, name: true },
    });

    return rules.map((rule) => ({ name: rule.name, value: rule.name }));
  }
  return null;
}

export default class HubBlockwordsCreateSubcommand extends BaseCommand {
  constructor() {
    super({
      name: 'create',
      types: { slash: true, prefix: true },
      description: '🧱 Add a new block word rule to your hub.',
      options: [hubOption],
    });
  }

  public async execute(ctx: Context) {
    const hubName = ctx.options.getString('hub') ?? undefined;

    const hub = await fetchHub({ name: hubName });
    if (
      !hub ||
			!(await runHubPermissionChecksAndReply(hub, ctx, {
			  checkIfManager: true,
			  checkIfStaff: true,
			}))
    ) return;

    const modal = buildBlockWordModal(hub.id);
    await ctx.showModal(modal);
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== 'edit') return;

    const choices = await getBlockWordRules(interaction);
    await interaction.respond(choices ?? []);
  }

  @RegisterInteractionHandler('blockwordsModal')
  async handleModals(interaction: ModalSubmitInteraction) {
    const customId = CustomID.parseCustomId(interaction.customId);
    const [hubId, ruleId] = customId.args as [string, string?];

    const hub = await fetchHub({ id: hubId });
    if (!hub) return;

    await interaction.reply({
      content: `${getEmoji('loading', interaction.client)} Validating blocked words...`,
      flags: ['Ephemeral'],
    });

    const name = interaction.fields.getTextInputValue('name');
    const newWords = sanitizeWords(
      interaction.fields.getTextInputValue('words'),
    );

    // new rule
    if (!ruleId) {
      if ((await hub.fetchBlockWords()).length >= 2) {
        await interaction.editReply(
          'You can only have 2 block word rules per hub.',
        );
        return;
      }

      const rule = await db.blockWord.create({
        data: { hubId, name, createdBy: interaction.user.id, words: newWords },
      });

      const embed = buildBWRuleEmbed(rule, interaction.client);
      const buttons = buildBlockedWordsBtns(hub.id, rule.id).addComponents(
        new ButtonBuilder(),
      );
      await interaction.editReply({
        content: `${getEmoji('tick_icon', interaction.client)} Rule added.`,
        embeds: [embed],
        components: [buttons],
      });
    }
    // remove rule
    else if (newWords.length === 0) {
      await db.blockWord.delete({ where: { id: ruleId } });
      await interaction.editReply(
        `${getEmoji('tick_icon', interaction.client)} Rule removed.`,
      );
    }

    // update rule
    else {
      await db.blockWord.update({
        where: { id: ruleId },
        data: { words: newWords, name },
      });
      await interaction.editReply(
        `${getEmoji('tick_icon', interaction.client)} Rule updated.`,
      );
    }
  }
}
