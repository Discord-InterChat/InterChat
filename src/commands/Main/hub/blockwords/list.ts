import { getBlockWordRules } from '#src/commands/Main/hub/blockwords/create.js';
import { hubOption } from '#src/commands/Main/hub/index.js';
import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import {
  fetchHub,
  runHubPermissionChecksAndReply,
} from '#src/utils/hub/utils.js';
import { buildBlockWordListEmbed } from '#src/utils/moderation/blockWords.js';
import type { AutocompleteInteraction } from 'discord.js';

export default class ListBlockWords extends BaseCommand {
  constructor() {
    super({
      name: 'list',
      description: '📜 View all blocked word rules for a hub.',
      types: { slash: true, prefix: true },
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

    const blockWords = await hub.fetchBlockWords();

    if (!blockWords.length) {
      await ctx.replyEmbed('hub.blockwords.notFound', { flags: ['Ephemeral'] });
      return;
    }

    const embed = buildBlockWordListEmbed(blockWords, ctx.client);
    await ctx.reply({ embeds: [embed] });
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== 'edit') return;

    const choices = await getBlockWordRules(interaction);
    await interaction.respond(choices ?? []);
  }
}
