import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import BaseCommand from '../../../core/BaseCommand.js';
import db from '../../../utils/Db.js';
import { simpleEmbed } from '../../../utils/Utils.js';
import { emojis } from '../../../utils/Constants.js';

export default class Unban extends BaseCommand {
  readonly staffOnly = true;
  data: RESTPostAPIChatInputApplicationCommandsJSONBody = {
    name: 'unban',
    description: '🔨 Unban a user from using the bot. (Dev Only)',
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: 'user',
        description: '🔨 The user to unban.',
        required: true,
      },
    ],
  };
  override async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    const user = interaction.options.getUser('user', true);
    const alreadyBanned = await db.userData.findFirst({
      where: { userId: user.id, banMeta: { isSet: true } },
    });

    if (!alreadyBanned) {
      await interaction.reply({
        embeds: [simpleEmbed(`${emojis.slash} User **${user.username}** is not banned.`)],
      });
      return;
    }

    await db.userData.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        username: user.username,
        viewedNetworkWelcome: false,
        voteCount: 0,
        banMeta: { set: null },
      },
      update: {
        banMeta: { set: null },
      },
    });

    await interaction.reply({
      embeds: [
        simpleEmbed(
          `${emojis.tick} Successfully banned **${user.username}**. They can no longer use the bot.`,
        ),
      ],
    });
  }
}
