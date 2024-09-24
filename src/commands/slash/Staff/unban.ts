import { emojis } from '#main/config/Constants.js';
import BaseCommand, { type CmdData } from '#main/core/BaseCommand.js';
import { InfoEmbed } from '#main/utils/EmbedUtils.js';
import { type ChatInputCommandInteraction, ApplicationCommandOptionType } from 'discord.js';

export default class Unban extends BaseCommand {
  readonly staffOnly = true;
  data: CmdData = {
    name: 'unban',
    description: '🔨 Unban a user from using the bot (Staff Only)',
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'user',
        description: '👤 The user to unban',
        required: true,
      },
    ],
  };
  override async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    const user = interaction.options.getUser('user', true);

    const { userManager } = interaction.client;
    const alreadyBanned = await userManager.getUser(user.id);

    if (!alreadyBanned?.banMeta?.reason) {
      const notBannedEmbed = new InfoEmbed().setDescription(
        `${emojis.slash} User **${user.username}** is not banned.`,
      );
      await interaction.reply({ embeds: [notBannedEmbed] });
      return;
    }

    await userManager.unban(user.id, user.username);

    const unbanEmbed = new InfoEmbed().setDescription(
      `${emojis.tick} Successfully unbanned \`${user.username}\`. They can use the bot again.`,
    );
    await interaction.reply({ embeds: [unbanEmbed] });
  }
}
