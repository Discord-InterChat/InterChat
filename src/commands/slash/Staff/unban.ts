import BaseCommand, { type CmdData } from '#main/core/BaseCommand.js';
import { emojis } from '#main/utils/Constants.js';
import db from '#main/utils/Db.js';
import { getDbUser, simpleEmbed } from '#main/utils/Utils.js';
import {
  type ChatInputCommandInteraction,
  ApplicationCommandOptionType,
} from 'discord.js';

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
    const alreadyBanned = await getDbUser(user.id);

    if (!alreadyBanned?.banMeta?.reason) {
      await interaction.reply({
        embeds: [simpleEmbed(`${emojis.slash} User **${user.username}** is not banned.`)],
      });
      return;
    }

    await db.userData.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        username: user.username,
        viewedNetworkWelcome: false,
        voteCount: 0,
        banMeta: { set: null },
      },
      update: { banMeta: { set: null } },
    });

    await interaction.reply({
      embeds: [
        simpleEmbed(
          `${emojis.tick} Successfully unbanned \`${user.username}\`. They can use the bot again.`,
        ),
      ],
    });
  }
}
