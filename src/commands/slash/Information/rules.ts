import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import BaseCommand from '#main/core/BaseCommand.js';
import { LINKS, colors } from '#main/utils/Constants.js';
import { t } from '#main/utils/Locale.js';

export default class Rules extends BaseCommand {
  readonly data = {
    name: 'rules',
    description: 'Sends the network rules for InterChat.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const { userManager } = interaction.client;
    const locale = await userManager.getUserLocale(interaction.user.id);
    const rulesEmbed = new EmbedBuilder()
      .setDescription(t({ phrase: 'rules', locale }, { support_invite: LINKS.SUPPORT_INVITE }))
      .setImage(LINKS.RULES_BANNER)
      .setColor(colors.interchatBlue);

    await interaction.reply({ embeds: [rulesEmbed] });
  }
}
