import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from 'discord.js';
import BaseCommand, { type CmdData } from '#main/core/BaseCommand.js';
import { InfoEmbed } from '#utils/EmbedUtils.js';
import UserDbService from '#main/services/UserDbService.js';

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

    const userService = new UserDbService();
    const alreadyBanned = await userService.getUser(user.id);

    if (!alreadyBanned?.banReason) {
      const notBannedEmbed = new InfoEmbed().setDescription(
        `${this.getEmoji('slash')} User **${user.username}** is not banned.`,
      );
      await interaction.reply({ embeds: [notBannedEmbed] });
      return;
    }

    await userService.unban(user.id, user.username);

    const unbanEmbed = new InfoEmbed().setDescription(
      `${this.getEmoji('tick')} Successfully unbanned \`${user.username}\`. They can use the bot again.`,
    );
    await interaction.reply({ embeds: [unbanEmbed] });
  }
}
