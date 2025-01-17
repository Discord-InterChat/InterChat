import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import Constants from '#utils/Constants.js';
import { t } from '#utils/Locale.js';
import { fetchUserLocale } from '#main/utils/Utils.js';

export default class Rules extends BaseCommand {
  readonly data = {
    name: 'rules',
    description: '📋 Sends the network rules for InterChat.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const locale = await fetchUserLocale(interaction.user.id);
    const rulesEmbed = new EmbedBuilder()
      .setDescription(t('rules.rules', locale, { rules_emoji: this.getEmoji('rules_icon') }))
      .setImage(Constants.Links.RulesBanner)
      .setColor(Constants.Colors.interchatBlue);

    await interaction.reply({ embeds: [rulesEmbed] });
  }
}
