import BaseCommand from '#main/core/BaseCommand.js';
import { emojis } from '#main/config/Constants.js';
import db from '#main/utils/Db.js';
import Logger from '#main/utils/Logger.js';
import {
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  ApplicationCommandOptionType,
} from 'discord.js';

export default class Ban extends BaseCommand {
  readonly staffOnly = true;
  data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'ban',
    description: '🔨 Ban a user from using the bot. (Dev Only)',
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'user',
        description: '🔨 The user to ban.',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'reason',
        description: 'Reason for the ban',
        required: true,
      },
    ],
  };
  override async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    if (user.id === interaction.user.id) {
      await this.replyEmbed(interaction, `Let's not go there. ${emojis.bruhcat}`, {
        ephemeral: true,
      });
      return;
    }

    const dbUser = await interaction.client.userManager.getUser(user.id);
    if (dbUser?.banMeta) {
      await this.replyEmbed(
        interaction,
        `${emojis.slash} User **${user.username}** is already banned.`,
      );
      return;
    }

    await db.userData.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        username: user.username,
        viewedNetworkWelcome: false,
        voteCount: 0,
        banMeta: { reason },
      },
      update: { banMeta: { reason } },
    });

    Logger.info(`User ${user.username} (${user.id}) banned by ${interaction.user.username}.`);

    await this.replyEmbed(
      interaction,
      `${emojis.tick} Successfully banned \`${user.username}\`. They can no longer use the bot.`,
    );
  }
}
