import BaseCommand from '#src/core/BaseCommand.js';
import type Context from '#src/core/CommandContext/Context.js';
import { fetchUserLocale } from '#src/utils/Utils.js';
import Constants from '#utils/Constants.js';
import { t } from '#utils/Locale.js';
import { EmbedBuilder } from 'discord.js';

export default class Rules extends BaseCommand {
  constructor() {
    super({
      name: 'rules',
      description: '📋 Sends the network rules for InterChat.',
      types: { slash: true, prefix: true },
    });
  }

  async execute(ctx: Context) {
    const locale = await fetchUserLocale(ctx.user.id);
    const rulesEmbed = new EmbedBuilder()
      .setDescription(t('rules.rules', locale, { rules_emoji: ctx.getEmoji('rules_icon') }))
      .setImage(Constants.Links.RulesBanner)
      .setColor(Constants.Colors.interchatBlue);

    await ctx.reply({ embeds: [rulesEmbed] });
  }
}
