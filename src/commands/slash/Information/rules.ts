import BaseCommand from '#main/core/BaseCommand.js';
import Constants from '#main/utils/Constants.js';
import { t } from '#main/utils/Locale.js';
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export default class Rules extends BaseCommand {
  readonly data = {
    name: 'rules',
    description: 'Sends the network rules for InterChat.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const rulesEmbed = new EmbedBuilder()
      .setDescription(t({ phrase: 'rules', locale }, { support_invite: Constants.Links.SupportInvite }))
      .setImage(Constants.Links.RulesBanner)
      .setColor(Constants.Colors.interchatBlue);

    await interaction.reply({ embeds: [rulesEmbed] });
  }
}
