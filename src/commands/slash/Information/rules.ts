import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import BaseCommand from '../../BaseCommand.js';
import { LINKS, colors } from '../../../utils/Constants.js';
import locales from '../../../utils/locales.js';
export default class Rules extends BaseCommand {
  readonly data = {
    name: 'rules',
    description: 'Sends the network rules for InterChat.',
  };
  async execute(interaction: ChatInputCommandInteraction) {
    const rulesEmbed = new EmbedBuilder()
      .setDescription(
        locales(
          { phrase: 'commands.rules.embed.description', locale: interaction.user.locale },
          { support_invite: LINKS.SUPPORT_INVITE },
        ),
      )
      .setImage(LINKS.RULES_BANNER)
      .setColor(colors.interchatBlue);

    await interaction.reply({ embeds: [rulesEmbed] });
  }
}
